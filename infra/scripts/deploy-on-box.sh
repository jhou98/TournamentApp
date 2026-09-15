#!/usr/bin/env bash
#
# deploy-on-box.sh — runs ON the EC2 instance via SSM Run Command.
#
# It is shipped inside the release tarball (infra/scripts/) and invoked from the
# extracted release directory. It reads configuration from environment variables
# exported by the SSM command (see .github/workflows/deploy.yml):
#
#   ARTIFACT_BUCKET   S3 bucket holding the release tarball
#   ARTIFACT_KEY      S3 key of the release tarball (releases/<sha>.tar.gz)
#   RELEASE_SHA       commit SHA identifying this release
#   AWS_REGION        region for aws cli calls
#   DB_ENDPOINT       RDS writer endpoint (private)
#   DB_PORT           RDS port (5432)
#   DB_NAME           database name
#   DB_SECRET_ARN     Secrets Manager ARN with {username,password}
#   APP_SECRET_ARN    Secrets Manager ARN with {JWT_SECRET,BOOTSTRAP_ADMIN_CODE}
#   APP_PORT          port the Node server listens on
#
set -euo pipefail

: "${ARTIFACT_BUCKET:?}" "${ARTIFACT_KEY:?}" "${RELEASE_SHA:?}" "${AWS_REGION:?}"
: "${DB_ENDPOINT:?}" "${DB_PORT:?}" "${DB_NAME:?}" "${DB_SECRET_ARN:?}"
: "${APP_SECRET_ARN:?}" "${APP_PORT:?}"

APP_ROOT=/opt/tournamentapp
RELEASE_DIR="${APP_ROOT}/releases/${RELEASE_SHA}"
export AWS_REGION AWS_DEFAULT_REGION="${AWS_REGION}"

echo "==> Fetching release ${RELEASE_SHA} from s3://${ARTIFACT_BUCKET}/${ARTIFACT_KEY}"
rm -rf "${RELEASE_DIR}"
mkdir -p "${RELEASE_DIR}"
aws s3 cp "s3://${ARTIFACT_BUCKET}/${ARTIFACT_KEY}" /tmp/release.tar.gz
tar -xzf /tmp/release.tar.gz -C "${RELEASE_DIR}"
rm -f /tmp/release.tar.gz

echo "==> Resolving secrets"
DB_JSON="$(aws secretsmanager get-secret-value --secret-id "${DB_SECRET_ARN}" --query SecretString --output text)"
APP_JSON="$(aws secretsmanager get-secret-value --secret-id "${APP_SECRET_ARN}" --query SecretString --output text)"
DB_USER="$(jq -r .username <<<"${DB_JSON}")"
DB_PASS="$(jq -r .password <<<"${DB_JSON}")"
JWT_SECRET="$(jq -r .JWT_SECRET <<<"${APP_JSON}")"
BOOTSTRAP_ADMIN_CODE="$(jq -r .BOOTSTRAP_ADMIN_CODE <<<"${APP_JSON}")"
REGISTRATION_CODE="$(jq -r .REGISTRATION_CODE <<<"${APP_JSON}")"

# Password is generated with ExcludePunctuation, so it is URL-safe as-is.
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@${DB_ENDPOINT}:${DB_PORT}/${DB_NAME}?schema=public&sslmode=require"

echo "==> Writing server/.env"
cat >"${RELEASE_DIR}/server/.env" <<ENV
DATABASE_URL="${DATABASE_URL}"
DIRECT_URL="${DATABASE_URL}"
JWT_SECRET="${JWT_SECRET}"
BOOTSTRAP_ADMIN_CODE="${BOOTSTRAP_ADMIN_CODE}"
REGISTRATION_CODE="${REGISTRATION_CODE}"
PORT=${APP_PORT}
ENV
chmod 600 "${RELEASE_DIR}/server/.env"

echo "==> Installing dependencies"
cd "${RELEASE_DIR}"
npm ci

echo "==> Prisma generate + migrate deploy"
cd "${RELEASE_DIR}/server"
npx prisma generate
npx prisma migrate deploy

# Seed once (default tournament + bootstrap admin) on the very first deploy.
if [ ! -f "${APP_ROOT}/.seeded" ]; then
  echo "==> First deploy: seeding database"
  npm run db:seed
  touch "${APP_ROOT}/.seeded"
fi

echo "==> Activating release ${RELEASE_SHA}"
ln -sfn "${RELEASE_DIR}" "${APP_ROOT}/current"
chown -R tournament:tournament "${APP_ROOT}/releases/${RELEASE_SHA}" "${APP_ROOT}/current"

systemctl restart tournamentapp.service
sleep 3
systemctl is-active tournamentapp.service

# Prune old releases, keeping the 5 most recent.
cd "${APP_ROOT}/releases"
ls -1dt */ 2>/dev/null | tail -n +6 | xargs -r rm -rf

echo "==> Deploy complete: ${RELEASE_SHA}"
