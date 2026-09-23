# Security Policy

## Reporting a vulnerability

Please do not open a public issue for security problems.

Report vulnerabilities through the chat widget on [elasticemail.com](https://elasticemail.com). This
covers these examples, the official SDKs and the Elastic Email platform. Include the file or product,
the problem and how to reproduce it. We will reply to confirm we have received the report.

## Scope

These are examples meant to be copied into other projects, so issues that would carry over into
production code are in scope, for example:

- webhook or inbound handlers that accept requests without checking the token, or check it in a way
  that can be bypassed
- secrets written to logs or returned in responses
- injection through email fields, merge fields or form input

## If you leaked an API key

If you committed an Elastic Email API key to this or any other repository, revoke it right away in
[API settings](https://help.elasticemail.com/en/articles/4799160-api-settings) and create a new one.
Removing the commit does not remove the key from forks, caches or clones.
