# Security Policy

## Reporting a vulnerability

Please use [GitHub Private Vulnerability Reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
on this repository. Do not open a public issue for security reports.

## Scope

- Source code in this repository
- The production deployment at https://wwwatch.dev

## What is in scope

- Vulnerabilities in the application (auth, injection, XSS, SSRF, etc.)
- Misuse of secrets or credentials handling
- Issues that let an attacker bypass the unsubscribe HMAC, send mail as
  wwwatch, or read other subscribers' data

## What is out of scope

- Anything requiring physical access or social engineering
- Third-party services we depend on (Anthropic, Neon, Resend, Vercel,
  PostHog) — report to them directly
- Denial-of-service via brute traffic
- Best-practice findings without a demonstrable impact

## Response

This is a small project maintained on a best-effort basis. Expect:

- Acknowledgement within a few days
- A fix or mitigation timeline based on severity
- Public disclosure via a GitHub Security Advisory once the fix ships

## Known accepted risks

- `npm audit` reports two moderate findings via `postcss` < 8.5.10,
  reachable through Next.js. Tracked upstream; no in-tree fix until
  Next.js bumps its dependency.
- `/api/subscribe` has no application-level rate limiting at the MVP
  stage. Vercel platform protections apply.
