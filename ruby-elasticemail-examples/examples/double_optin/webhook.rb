#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Double Opt-In: Webhook Handler
#
# Alternative confirmation flow driven by Elastic Email click tracking.
# Create a webhook (see examples/webhooks.rb) pointing at POST /double-optin/webhook.
# When the recipient clicks the confirm link, Elastic Email reports status=Clicked
# with the clicked URL in "target". The contact is then added to the list.
#
# Usage: ruby examples/double_optin/webhook.rb

require_relative "../ee"
require "sinatra"
require "sinatra/json"
require "rack/utils"

set :port, ENV.fetch("PORT", 3000).to_i
set :bind, "0.0.0.0"

lists_api = ElasticEmail::ListsApi.new

helpers do
  def token_ok?(token)
    Rack::Utils.secure_compare(token.to_s, WEBHOOK_TOKEN)
  end

  def sanitize(value)
    value.to_s.delete("\r\n")
  end
end

# Elastic Email validates the URL with a GET when the webhook is saved.
get "/double-optin/webhook" do
  halt 401, json(error: "Invalid token") unless token_ok?(params["token"])
  json(ok: true)
end

post "/double-optin/webhook" do
  halt 401, json(error: "Invalid token") unless token_ok?(params["token"])

  status_value = sanitize(params["status"])
  target = sanitize(params["target"])
  recipient = sanitize(params["to"])

  unless status_value == "Clicked" && target.include?("/double-optin/confirm")
    return json(received: true, status: status_value, message: "Event ignored")
  end

  begin
    lists_api.lists_by_name_contacts_post(LIST_NAME, ElasticEmail::EmailsPayload.new(emails: [recipient]))
    puts "Subscription confirmed via click: #{recipient}"
    json(received: true, confirmed: true, email: recipient, list: LIST_NAME)
  rescue ElasticEmail::ApiError => e
    warn "Error adding contact to list: #{e.code} #{e.response_body || e.message}"
    halt 500, json(error: e.response_body || e.message)
  end
end

puts "Double opt-in webhook listening on http://localhost:#{settings.port}/double-optin/webhook"
