#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Double Opt-In: Webhook Handler
#
# Alternative confirmation flow driven by Elastic Email click tracking.
# Create a webhook (see examples/webhooks.rb) pointing at /double-optin/webhook.
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

  # Returns the event fields (lowercase keys) or halts with 401.
  # With ELASTICEMAIL_WEBHOOK_SECRET set the signature is required and the event comes
  # from the JSON body (POST) or the query string (GET); otherwise ?token= is checked.
  def webhook_event
    if WEBHOOK_SECRET.empty?
      halt 401, json(error: "Invalid token") unless token_ok?(params["token"])
      return params.to_h.transform_keys { |k| k.to_s.downcase }
    end

    body = request.body.read.to_s
    target = request.env["REQUEST_URI"] || request.fullpath # raw path + query as received
    unless verify_signature(WEBHOOK_SECRET, request.env["HTTP_X_ELASTICEMAIL_TIMESTAMP"],
                            request.env["HTTP_X_ELASTICEMAIL_SIGNATURE"], request.request_method, target, body)
      halt 401, json(error: "Invalid signature")
    end

    event = request.get? ? request.GET : (JSON.parse(body) rescue {})
    event.is_a?(Hash) ? event.transform_keys { |k| k.to_s.downcase } : {}
  end
end

# Elastic Email sends a test event when the webhook is saved; GET is accepted too.
def handle_click(lists_api)
  event = webhook_event
  status_value = sanitize(event["status"])
  target = sanitize(event["target"])
  recipient = sanitize(event["to"])

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

get("/double-optin/webhook") { handle_click(lists_api) }
post("/double-optin/webhook") { handle_click(lists_api) }

puts "Double opt-in webhook listening on http://localhost:#{settings.port}/double-optin/webhook"
