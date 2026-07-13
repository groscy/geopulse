# Security Policy

## Supported versions

GeoPulse is developed on a rolling basis. Security fixes are applied to the
`main` branch and shipped in the next tagged release / `latest` container image.
Please make sure you are running the most recent release before reporting.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues,
discussions, or pull requests.**

Instead, report privately using GitHub's
[**Report a vulnerability**](https://github.com/groscy/geopulse/security/advisories/new)
button under the repository's **Security** tab. If that is unavailable, email the
maintainer at **cyril.grossenbacher@gmx.ch** with the details.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (proof-of-concept, affected endpoint or component).
- The version / image tag or commit you tested against.
- Any suggested remediation, if you have one.

## What to expect

- **Acknowledgement** within a few days of your report.
- An assessment of the issue and an expected timeline for a fix.
- Credit for the discovery once a fix is released, unless you prefer to remain
  anonymous.

## Scope notes

GeoPulse is a local-first dashboard intended to run on a trusted host. A few
things are **by design**, not vulnerabilities:

- Postgres runs inside the container on `localhost` with a default password
  (`geopulse`) and is never published. Override it with `POSTGRES_PASSWORD` on
  first boot — see the [README](README.md#database-password-optional).
- The API binds to `127.0.0.1:8000` inside the container and is only reachable
  through the bundled nginx reverse proxy.
- Ingested third-party data (markets, FX, GDELT, macro, weather) is treated as
  untrusted input by the workers.

Thank you for helping keep GeoPulse and its users safe.
