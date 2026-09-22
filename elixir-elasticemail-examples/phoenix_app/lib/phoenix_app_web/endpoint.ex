defmodule PhoenixAppWeb.Endpoint do
  use Phoenix.Endpoint, otp_app: :phoenix_app

  # Elastic Email webhooks and inbound notifications are form-encoded.
  # Inbound emails carry base64 attachments, hence the 25 MB limit.
  plug Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    json_decoder: Jason,
    length: 25_000_000

  plug PhoenixAppWeb.Router
end
