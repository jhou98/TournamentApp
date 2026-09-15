import type { RequestHandler } from "express";
import { ValidationError } from "../../../../domain/errors.js";
import { scanForSqlInjection, sqlInjectionDecoy } from "../../../../domain/security.js";

/**
 * Content-Security-Policy tuned for this app: the server serves the built SPA
 * plus the JSON API from a single origin. Scripts are same-origin only (Vite
 * emits hashed module files, no inline scripts); inline styles are allowed for
 * React style props / Tailwind, and Google Fonts is whitelisted to match
 * client/index.html.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "img-src 'self' data:",
  "font-src 'self' https://fonts.gstatic.com data:",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "script-src 'self'",
  "connect-src 'self'",
].join("; ");

/**
 * Baseline security response headers. These blunt the impact of XSS and
 * clickjacking (CSP + frame denial), stop MIME sniffing, and trim referrer
 * leakage. Applied to every response, API and SPA alike.
 */
export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-XSS-Protection", "0"); // Rely on CSP; the legacy filter is unsafe.
  next();
};

/**
 * Reject requests whose body or query string looks like a SQL-injection probe.
 * Prisma already parameterizes every query, so this is a belt-and-suspenders
 * outer wall — and a place to have a little fun: repeat offenders get a rotating
 * decoy message instead of a plain rejection.
 */
export function makeSqlInjectionGuard(): RequestHandler {
  let detections = 0;
  return (req, _res, next) => {
    if (scanForSqlInjection(req.body) || scanForSqlInjection(req.query)) {
      const message = sqlInjectionDecoy(detections);
      detections += 1;
      next(new ValidationError(message));
      return;
    }
    next();
  };
}
