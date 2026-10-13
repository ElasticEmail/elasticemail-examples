defmodule PhoenixAppWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :phoenix_app

  # Inbound notifications and unsigned webhooks are form-encoded; signed webhooks POST JSON.
  # The body reader keeps the raw body in conn.assigns.raw_body for the webhook signature
  # check (ElasticEmail.Webhook). Inbound emails carry base64 attachments, hence the 25 MB limit.
  plug Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    json_decoder: Jason,
    body_reader: {ElasticEmail.Webhook, :read_body, []},
    length: 25_000_000

  plug PhoenixAppWeb.Router
end
