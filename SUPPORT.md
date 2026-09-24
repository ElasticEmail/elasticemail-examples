# Support

This repository holds code examples. It is not the support channel for the Elastic Email
platform, so please pick the right place for your question.

## Questions about your Elastic Email account or the API

Account access, billing, domain verification, deliverability, blocked sends, rate limits, API
behavior that does not match the docs: talk to Elastic Email support through the chat widget on
[elasticemail.com](https://elasticemail.com). The people there can look at your account; the
maintainers of this repository cannot.

Before you ask, these usually resolve the common cases:

- [How to verify your domain](https://help.elasticemail.com/en/articles/4934400-how-to-verify-your-domain)
  (most "the send returned 200 but nothing arrived" reports)
- [API settings](https://help.elasticemail.com/en/articles/4799160-api-settings) for creating and
  scoping API keys
- [API reference](https://elasticemail.com/developers/api-documentation/rest-api)

## Problems with the examples

If an example does not compile, throws, uses a wrong SDK method, or the README is out of date,
[open an issue](https://github.com/ElasticEmail/elasticemail-examples/issues/new/choose). Include
the stack, the file, the SDK version and the error output. Check
[docs/troubleshooting.md](docs/troubleshooting.md) and
[docs/error-handling.md](docs/error-handling.md) first; many failures come down to
`EMAIL_FROM` not being on a verified domain or a missing environment variable.

Requests for a new stack or a new use case also go through the issue tracker. Use the "New
example or stack" template.

## Security issues

Do not open a public issue. See [SECURITY.md](SECURITY.md).

## Contributing

Fixes and new stacks are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers the conventions.
