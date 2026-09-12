import bcrypt from "bcryptjs";
import type { PasswordHasher } from "../../ports/index.js";

const SALT_ROUNDS = 10;

export function makeBcryptHasher(): PasswordHasher {
  return {
    hash(plain) {
      return bcrypt.hash(plain, SALT_ROUNDS);
    },
    verify(plain, hash) {
      return bcrypt.compare(plain, hash);
    },
  };
}
