defmodule PhoenixAppWeb.Router do
  use Phoenix.Router

  scope "/", PhoenixAppWeb do
    get "/health", HealthController, :show
    post "/send", EmailController, :send_email

    # Signed webhooks POST JSON; unsigned ones use GET (query string) or POST (form fields)
    get "/webhook", WebhookController, :handle
    post "/webhook", WebhookController, :handle

    post "/inbound", InboundController, :create

    post "/double-optin/subscribe", DoubleOptinController, :subscribe
    get "/double-optin/confirm", DoubleOptinController, :confirm
    get "/double-optin/webhook", DoubleOptinController, :webhook
    post "/double-optin/webhook", DoubleOptinController, :webhook
  end
end
