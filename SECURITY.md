# Security policy

## Supported version

Security fixes target the latest tagged release and the `main` branch.

## Report a vulnerability

Use GitHub's private vulnerability reporting for this repository. Do not open a
public issue for vulnerabilities involving URL validation, redirects, private
network access, path traversal, credential disclosure, file validation, or
arbitrary command execution.

Include the affected command, platform, minimal reproduction, and impact. Never
include a real IKEA model, session token, signed URL, cookie, or other secret;
use a synthetic fixture instead.

## Security model

The CLI accepts untrusted paths, capture metadata, and network URLs. Its security
boundary includes official IKEA HTTPS allowlisting, rejection of credentials and
private/local network destinations, bounded redirects and download sizes, GLB
validation, atomic publication, and output paths confined to the collection.
These checks must not be bypassed for convenience.

Release review must also scan the worktree, staged diff, documentation, image
metadata, and Git history for local absolute paths, usernames, tokens, keys,
cookies, signed URLs, and other machine-specific or sensitive information.
