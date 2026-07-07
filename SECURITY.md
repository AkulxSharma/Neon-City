# Security Policy

## Supported Versions

Neon City Drive is a single-file browser game served from the `main` branch.
Only the latest version of `index.html` on `main` is supported.

| Version | Supported |
| ------- | --------- |
| main (latest) | Yes |
| older commits | No |

## Reporting a Vulnerability

This is a static, client-side game with no backend, server, or user data
storage beyond the browser's local `localStorage` autosave, so the attack
surface is small. Still, if you find something (a way to inject or execute
arbitrary script through game input, or an issue with how the page handles
browser storage), please report it responsibly:

1. **Do not** open a public issue for security vulnerabilities.
2. Instead, use GitHub's [private vulnerability reporting](../../security/advisories/new)
   feature on this repository, or contact the maintainer directly through
   their GitHub profile.
3. Include a clear description of the issue, steps to reproduce, and the
   potential impact.

We'll do our best to acknowledge reports promptly and follow up with a fix or
explanation.

## Scope

Out of scope: issues that require a compromised browser/OS, or that rely on
the user manually pasting untrusted code into the developer console.
