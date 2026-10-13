# Security policy

## Supported versions

Only the latest released version of RTL Chat gets security fixes.

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately by email to `musaad.sharikh@gmail.com`.

When this repository's Security tab shows a **Report a vulnerability** button, that
private form can be used instead.

Say which version you used, on which Firefox, and how to reproduce the problem. A
report is answered as soon as its maintainer can get to it; this is a one-person
project with no guaranteed response time.

## What counts

RTL Chat runs a content script on the sites it has access to and changes text
direction there. It makes no network requests itself and loads no remote code. Reports of
particular interest:

- the extension acting on a site the user did not enable;
- content from a page changing what the extension does beyond text direction;
- settings or site names leaving the browser by any route other than Firefox Sync,
  which may synchronize the extension's settings between a user's own browsers through
  Mozilla when the user has it on.

A site whose layout the extension gets wrong is a bug, not a vulnerability: report it
as an ordinary issue.
