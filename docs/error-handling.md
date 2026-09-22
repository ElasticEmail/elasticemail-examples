# Error handling

Every failure from the API has the same body:

```json
{"Error": "Invalid API key"}
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
ElasticEmail.format_error({:error, 400, %{"Error" => "Invalid API key"}})  # "400: Invalid API key"
ElasticEmail.error_message(...)   # message only, for JSON responses
```

## Status codes you will meet

| Status | Usual cause |
|---|---|
| 400 | Malformed payload, or "already exists" from `listsPost` / `domainsPost` - see below |
| 401 | Missing or wrong API key |
| 402 | Out of credits |
| 403 | The key lacks permission for this operation, or the feature is not on the plan |
| 404 | No such template, contact, domain or transaction |
| 429 | Rate limited - back off and retry |
| 5xx | Server side; retry with backoff |

## "Already exists" is a 400

`listsPost` and `domainsPost` answer 400 with a message containing "exist" when the resource is
already there. Every example treats that one case as success, which is what makes the scripts safe
to re-run:

```typescript
if (err.response?.status === 400 && /exist/i.test(JSON.stringify(err.response?.data))) {
  // already there
}
```

The equivalents: `ee_already_exists()` (PHP), `already_exists()` (Rust), and inline checks in the
Python, Ruby, Go, Java and C# examples.

## Retrying

Retry 429 and 5xx with exponential backoff. Do not retry 4xx - the payload will not become valid on
its own. Sends are not idempotent: a retry after a timeout can deliver twice. If that matters, record
the `TransactionID` and check the status before retrying.

## Logging

Values from webhook and inbound requests are attacker-controlled. Every example strips carriage
returns and newlines before logging:

```typescript
const sanitize = (value: unknown): string => String(value ?? "").replace(/[\r\n]/g, "");
```

Without that, anyone who can trigger a webhook can forge lines in your logs.
