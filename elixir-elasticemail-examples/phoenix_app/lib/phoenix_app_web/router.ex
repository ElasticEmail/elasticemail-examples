defmodule PhoenixAppWeb.Router do
  use Phoenix.Router

  scope "/", PhoenixAppWeb do
    get "/health", HealthController, :show
    post "/send", EmailController, :send_email

    # Elastic Email validates the webhook URL with a GET on save and posts events as form fields
    get "/webhook", WebhookController, :handle
    post "/webhook", WebhookController, :handle

    post "/inbound", InboundController, :create

    post "/double-optin/subscribe", DoubleOptinController, :subscribe
    get "/double-optin/confirm", DoubleOptinController, :confirm
    post "/double-optin/webhook", DoubleOptinController, :webhook
  end
end
