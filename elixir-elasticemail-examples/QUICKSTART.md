# Send your first email with Elixir

Five minutes from a clean clone to a delivered email. There is no official Elixir SDK, so these
examples call the REST API directly through a small `ElasticEmail` module built on
[Req](https://hex.pm/packages/req). The web example uses Phoenix.

## Prerequisites

- Elixir 1.15+ (OTP 25+)
- An [Elastic Email account](https://app.elasticemail.com)
- A verified sending domain

## 1. Get an API key

Create one at [app.elasticemail.com](https://app.elasticemail.com/marketing/settings/new/manage-api)
and copy it. You will not be able to read it again.

## 2. Verify your sending domain

Add your domain in the dashboard and publish the SPF and DKIM records it shows you. The `From`
address must be on a verified domain.

## 3. Install

```bash
git clone https://github.com/ElasticEmail/elasticemail-examples.git
cd elasticemail-examples/elixir-elasticemail-examples

mix deps.get
cp .env.example .env
```

In a project of your own:

```elixir
# mix.exs
defp deps do
  [
    {:req, "~> 0.5"},
    {:jason, "~> 1.4"}
  ]
end
```

## 4. Set your environment variables

Edit `.env`:

```env
ELASTICEMAIL_API_KEY=your_api_key
EMAIL_FROM=Acme <hello@yourdomain.com>
EMAIL_TO=you@yourdomain.com
```

`config/runtime.exs` loads the file and stops with a clear message when the key is missing. Full list
in [docs/environment-variables.md](../docs/environment-variables.md).

## 5. Send an email

The whole client is one module. Requests carry the key as a header; JSON keys are the PascalCase
names straight from the API reference:

```elixir
defmodule MyApp.ElasticEmail do
  @base_url "https://api.elasticemail.com/v4"

  def new do
    Req.new(
      base_url: @base_url,
      headers: [{"X-ElasticEmail-ApiKey", System.fetch_env!("ELASTICEMAIL_API_KEY")}]
    )
  end

  def send_transactional(data) do
    case Req.post(new(), url: "/emails/transactional", json: data) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 -> {:ok, body}
      {:ok, %Req.Response{status: status, body: body}} -> {:error, status, body}
      {:error, exception} -> {:error, 0, Exception.message(exception)}
    end
  end
end

MyApp.ElasticEmail.send_transactional(%{
  "Recipients" => %{"To" => [System.fetch_env!("EMAIL_TO")]},
  "Content" => %{
    "From" => System.fetch_env!("EMAIL_FROM"),
    "Subject" => "Hello from Elastic Email!",
    "Body" => [
      %{"ContentType" => "HTML", "Content" => "<h1>Welcome!</h1>"},
      %{"ContentType" => "PlainText", "Content" => "Welcome!"}
    ]
  }
})
```

Results are `{:ok, body}` for 2xx and `{:error, status, body}` otherwise, with `{:error, 0, reason}`
for a transport failure. API errors have the shape `%{"Error" => "message"}`.

Run the version in this repository:

```bash
mix run examples/basic_send.exs
```

`lib/elastic_email.ex` adds `get/2`, `post/3`, `put/2`, `patch/2`, `delete/1`, `path_segment/1` for
encoding emails and list names into URLs, and `format_error/1`.

## 6. Or run the Phoenix app

```bash
cd phoenix_app
mix deps.get
mix phx.server
```

It reads `../.env`, so one file serves both the scripts and the server.

```bash
curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"to":"you@yourdomain.com","subject":"Hello","message":"Hi from Phoenix!"}'
```

```json
{ "success": true, "transactionId": "...", "messageId": "..." }
```

## Next steps

```bash
mix run examples/batch_send.exs            # one call, personalized per recipient
mix run examples/with_attachments.exs      # base64 file attachment
mix run examples/with_cid_attachments.exs  # inline image via cid:
mix run examples/with_template.exs         # hosted template + merge values
mix run examples/webhooks.exs              # create, list, delete a webhook
```

Because there is no SDK in the way, the [API map](../docs/api-map.md) doubles as your reference: every
operation there lists the REST path this module takes.

| Do this | Read |
|---|---|
| Understand transactional vs bulk | [Sending email](../docs/sending-email.md) |
| Attach files or embed images | [Attachments](../docs/attachments.md) |
| React to opens, clicks and bounces | [Webhooks](../docs/webhooks.md) |
| Receive email, not just send it | [Inbound email](../docs/inbound-email.md) |
| Every script and route | [README.md](README.md) |
