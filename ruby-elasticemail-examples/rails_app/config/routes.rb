# frozen_string_literal: true

Rails.application.routes.draw do
  get "/health", to: "health#show"
  post "/send", to: "emails#send_email"
  match "/webhook", to: "webhooks#event", via: %i[get post]
  post "/inbound", to: "webhooks#inbound"
  post "/double-optin/subscribe", to: "double_optin#subscribe"
  get "/double-optin/confirm", to: "double_optin#confirm"
  post "/double-optin/webhook", to: "double_optin#webhook"
end
