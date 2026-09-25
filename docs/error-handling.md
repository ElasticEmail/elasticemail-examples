# Error handling

Every failure from the API has the same body:

```json
{"Error": "APIKey Expired"}
```

with a 4xx or 5xx status. The work in each language is getting from the SDK's exception type to that
status and that message. Every stack in this repository has a helper that does exactly this, and the
server apps use it to answer `{ "error": "<message>" }` with the API's own status code.

## Per language

### TypeScript / JavaScript

Axios errors. Status on `err.response.status`, body on `err.response.data`.

```typescript
export function apiError(err: unknown): { status: number; message: string } {
  const e = err as { response?: { status?: number; data?: { Error?: string } }; message?: string };
  return {
    status: e.response?.status ?? 500,
    message: e.response?.data?.Error ?? e.message ?? "Unknown error",
  };
}
```

### Python

```python
except ElasticEmail.ApiException as e:
    # e.status, e.body
```

`examples/ee.py` wraps this in `print_api_error(step, e)`.

### Ruby

```ruby
rescue ElasticEmail::ApiError => e
  # e.code, e.response_body
```

`examples/ee.rb` wraps this in `api_error(step, e)`.

### PHP

```php
catch (ElasticEmail\ApiException $e) {
    $status = $e->getCode();
    $body = $e->getResponseBody();   // {"Error": "..."}
}
```

`src/bootstrap.php` provides `ee_error_details()`, `ee_error()` and `ee_already_exists()`.
Laravel's `App\Services\ElasticEmail::errorDetails()` is the same logic behind a service class.

### Go

The SDK returns `(result, *http.Response, error)`. The status comes off the response, the body off
`*ElasticEmail.GenericOpenAPIError`:

```go
func APIError(resp *http.Response, err error) (int, string)   // internal/ee
```

Check `err` first; `resp` is nil on a transport failure, which is why `StatusCode()` guards for it.

### Java

```java
catch (ApiException e) {
    e.getCode();           // HTTP status
    e.getResponseBody();   // {"Error": "..."}
}
```

`Ee.printApiError(step, e)` formats both.

### C#

```csharp
catch (ApiException e) {
    e.ErrorCode;       // HTTP status
    e.ErrorContent;    // raw body
}
```

`Ee.ErrorMessage(e)` parses the `Error` property out of `ErrorContent` and falls back to the raw
body when it is not JSON.

### Rust

`Error<T>` from the SDK. Only the `ResponseError` variant carries a status and a body:

```rust
pub fn api_error_message<T: std::fmt::Debug>(err: &Error<T>) -> (u16, String)
```

`src/lib.rs` also has `is_not_found()` and `already_exists()` for the two cases worth branching on.

### Elixir

No SDK, so the shape is explicit. Results are `{:ok, body}` or `{:error, status, body}`, with
`{:error, 0, reason}` for a transport failure:

```elixir
ElasticEmail.format_error({:error, 400, %{"Error" => "APIKey Expired"}})  # "400: APIKey Expired"
ElasticEmail.error_message(...)   # message only, for JSON responses
```

## Status codes you will meet

The v4 API reports most client errors as **400**, including authentication and permission
problems: there is no 401, 402 or 403. Read the `Error` message to tell them apart.

| Status | Usual cause | Example `Error` |
|---|---|---|
| 400 | Missing, wrong or deleted API key | `APIKey Expired` |
| 400 | The key lacks the access level the call needs, or the account is disabled | `Access Denied.` |
| 400 | Invalid or missing parameter, unverified sender, or "already exists" from `listsPost` / `domainsPost` (see below) | `A list with the given name already exists.` |
| 404 | No such template, contact, domain, transaction, endpoint or method | `List not found.` |
| 409 | A file upload that conflicts with an existing file | |
| 412 | An account or plan limit, an invalid address in a contact upload, or a list that doesn't exist when adding contacts | `Too many contacts for current billing plan.` |
| 413 | Too many items in one request: more than 50 transactional recipients, or more than 1000 contacts or suppressions | `You cannot provide more than 50 transactional recipients` |
| 5xx | Server side; retry with backoff | |

Besides `Error`, an error body can carry `ErrorData`: an error reference ID for unexpected
failures. Include it when you contact support.

## "Already exists" is a 400

`listsPost` and `domainsPost` answer 400 when the resource is already there:
`A list with the given name already exists.` for a list, and `This domain is already associated
with this Account...` for a domain (no "exist" in that one). Every example treats that one case as
success, which is what makes the scripts safe to re-run:

```typescript
if (err.response?.status === 400 && /exist|already/i.test(JSON.stringify(err.response?.data))) {
  // already there
}
```

The equivalents: `ee_already_exists()` (PHP), `already_exists()` (Rust), and inline checks in the
Python, Ruby, Go, Java and C# examples.

## Retrying

Retry 5xx with exponential backoff, and 429 if you ever get one (the v4 API does not rate limit
today, but a proxy in between might). Do not retry other 4xx - the payload will not become valid on
its own. Sends are not idempotent: a retry after a timeout can deliver twice. If that matters, record
the `TransactionID` and check the status before retrying.

## Logging

Values from webhook and inbound requests are attacker-controlled. Every example strips carriage
returns and newlines before logging:

```typescript
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");
```

Without that, anyone who can trigger a webhook can forge lines in your logs.
