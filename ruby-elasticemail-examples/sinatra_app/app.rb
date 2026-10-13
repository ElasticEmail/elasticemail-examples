#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Sinatra Application with Elastic Email
#
# Usage:
#   ruby sinatra_app/app.rb
#
# Routes:
#   GET  /health
#   POST /send
#   GET|POST /webhook                (signed, or ?token=... for unsigned webhooks)
#   POST /inbound?token=...
#   POST /double-optin/subscribe
#   GET  /double-optin/confirm?email=&token=
#   GET|POST /double-optin/webhook   (signed, or ?token=... for unsigned webhooks)

require "bundler/setup"
require "sinatra"
require "sinatra/json"
require "ElasticEmail"
require "dotenv/load"
require "json"
require "openssl"
require "erb"
require "rack/utils"
require "securerandom"

api_key = ENV["ELASTICEMAIL_API_KEY"]
if api_key.nil? || api_key.empty?
  warn "ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env and add your API key."
  exit 1
end

ElasticEmail.configure do |config|
  config.api_key["X-ElasticEmail-ApiKey"] = api_key
end

FROM = ENV.fetch("EMAIL_FROM", "Acme <hello@yourdomain.com>")
CONTACT_EMAIL = ENV.fetch("CONTACT_EMAIL", FROM)
LIST_NAME = ENV.fetch("ELASTICEMAIL_LIST_NAME", "Newsletter")
PUBLIC_URL = ENV.fetch("PUBLIC_URL", "http://localhost:3000")
SECRET = ENV.fetch("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
# Signing secret returned once when the webhook is created with EnableSigning ("" when unset)
WEBHOOK_SECRET = ENV.fetch("ELASTICEMAIL_WEBHOOK_SECRET", "")
CONFIRM_REDIRECT_URL = ENV["CONFIRM_REDIRECT_URL"]

set :port, ENV.fetch("PORT", 3000).to_i
set :bind, "0.0.0.0"

EMAILS_API = ElasticEmail::EmailsApi.new
CONTACTS_API = ElasticEmail::ContactsApi.new
LISTS_API = ElasticEmail::ListsApi.new

# Inbound notifications and unsigned webhooks are form-encoded or query strings; the other
# routes (and signed POST webhooks) send JSON. Keep the raw body in @raw_body (the webhook
# signature is computed over it) and parse JSON bodies into @json_body.
before do
  content_type :json

  if request.content_type&.include?("application/json")
    @raw_body = request.body.read
    @json_body = @raw_body.empty? ? {} : JSON.parse(@raw_body)
  end
end

helpers do
  # Strip newlines from user-controlled values before logging
  def sanitize(value)
    value.to_s.delete("\r\n")
  end

  # Constant-time comparison of the shared secret carried in ?token=
  def token_ok?(token)
    Rack::Utils.secure_compare(token.to_s, SECRET)
  end

  def hmac(value)
    OpenSSL::HMAC.hexdigest("SHA256", SECRET, value)
  end

  # Verifies an Elastic Email webhook signature: lowercase hex HMAC-SHA256 of
  # "{timestamp}\n{METHOD}\n{request target}\n{raw body}" keyed with the signing secret.
  # The header may carry several comma-separated "v1=" entries; any match is accepted.
  # Requests older than 5 minutes are rejected.
  def verify_signature(secret, timestamp, signature_header, method, target, body, now: Time.now.to_i)
    return false if signature_header.to_s.empty? || !timestamp.to_s.match?(/\A\d+\z/)
    return false if (now - timestamp.to_i).abs > 300

    message = "#{timestamp}\n#{method}\n#{target}\n".b + body.to_s.b
    expected = OpenSSL::HMAC.hexdigest("SHA256", secret, message)
    signature_header.split(",").map(&:strip).any? do |entry|
      entry.start_with?("v1=") && OpenSSL.secure_compare(expected, entry.delete_prefix("v1="))
    end
  end

  # Returns the webhook event fields (lowercase keys) or halts with 401.
  # With ELASTICEMAIL_WEBHOOK_SECRET set the signature is required and the event comes
  # from the JSON body (POST) or the query string (GET); otherwise ?token= is checked.
  def webhook_event
    if WEBHOOK_SECRET.empty?
      halt 401, json(error: "Invalid token") unless token_ok?(params["token"])
      return params.to_h.transform_keys { |k| k.to_s.downcase }
    end

    body = @raw_body || request.body.read.to_s
    target = request.env["REQUEST_URI"] || request.fullpath # raw path + query as received
    unless verify_signature(WEBHOOK_SECRET, request.env["HTTP_X_ELASTICEMAIL_TIMESTAMP"],
                            request.env["HTTP_X_ELASTICEMAIL_SIGNATURE"], request.request_method, target, body)
      halt 401, json(error: "Invalid signature")
    end

    event = request.get? ? request.GET : (JSON.parse(body) rescue {})
    event.is_a?(Hash) ? event.transform_keys { |k| k.to_s.downcase } : {}
  end

  def api_error_response(e)
    message = begin
      JSON.parse(e.response_body.to_s)["Error"]
    rescue JSON::ParserError, TypeError
      nil
    end
    halt(e.code || 500, json(error: message || e.message || "Unknown error"))
  end

  def html_part(content)
    ElasticEmail::BodyPart.new(content_type: "HTML", content: content)
  end
end

get "/health" do
  json(status: "ok")
end

post "/send" do
  body = @json_body || {}
  to = body["to"]
  subject = body["subject"]
  message = body["message"]

  unless to && subject && message
    halt 400, json(error: "Missing required fields: to, subject, message")
  end

  # Forward the client's Idempotency-Key so its retries can't send twice; otherwise use a new one.
  idempotency_key = request.env["HTTP_IDEMPOTENCY_KEY"].to_s
  idempotency_key = SecureRandom.uuid if idempotency_key.empty?

  begin
    result = EMAILS_API.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [to]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: subject,
          body: [html_part("<p>#{message}</p>")]
        )
      ),
      idempotency_key: idempotency_key
    )
    json(success: true, transactionId: result.transaction_id, messageId: result.message_id)
  rescue ElasticEmail::ApiError => e
    api_error_response(e)
  end
end

# Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
# category, channel, target (clicked URL), ip, useragent, country, city.
# Signed webhooks (recommended, ELASTICEMAIL_WEBHOOK_SECRET set) are verified with HMAC-SHA256
# and usually arrive as POST with a JSON body. Unsigned webhooks carry ?token= and send the
# fields in the query string (GET) or as form fields (POST).
# Elastic Email sends a test event when the webhook is saved.
def handle_webhook
  event = webhook_event

  status_value = sanitize(event["status"])

  # Validation ping or empty request
  return json(ok: true) if status_value.empty?

  puts "Webhook event: #{status_value} to: #{sanitize(event['to'])} transaction: #{sanitize(event['transaction'])}"

  case status_value
  when "Sent"
    puts "Email sent, message id: #{sanitize(event['messageid'])}"
  when "Opened"
    puts "Email opened from #{sanitize(event['country'])} #{sanitize(event['city'])}"
  when "Clicked"
    puts "Link clicked: #{sanitize(event['target'])}"
  when "Error"
    puts "Bounce/error, category: #{sanitize(event['category'])}"
  when "AbuseReport"
    puts "Complaint received"
  when "Unsubscribed"
    puts "Recipient unsubscribed"
  end

  json(received: true, status: status_value)
end

get("/webhook") { handle_webhook }
post("/webhook") { handle_webhook }

# Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
# Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
# subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
post "/inbound" do
  halt 401, json(error: "Invalid token") unless token_ok?(params["token"])

  mail = params
  attachments = mail.keys
                    .select { |k| k.match?(/\Aatt\d+_name\z/) }
                    .map { |k| { name: mail[k], content: mail[k.sub("_name", "_content")] } }

  puts "Inbound email from: #{sanitize(mail['from_email'])} subject: #{sanitize(mail['subject'])}"
  names = attachments.map { |a| a[:name] }.join(", ")
  puts "Attachments: #{names.empty? ? 'none' : names}"

  # Forward a copy to the team inbox
  begin
    html = mail["body_html"]
    html = "<pre>#{Rack::Utils.escape_html(mail['body_text'].to_s)}</pre>" if html.nil? || html.empty?

    result = EMAILS_API.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [CONTACT_EMAIL]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          reply_to: mail["from_email"],
          subject: "Fwd: #{mail['subject'] || '(no subject)'}",
          body: [html_part(html)],
          attachments: attachments
            .reject { |a| a[:content].to_s.empty? }
            .map { |a| ElasticEmail::MessageAttachment.new(name: a[:name], binary_content: a[:content]) }
        )
      )
    )
    json(received: true, forwardedMessageId: result.message_id)
  rescue ElasticEmail::ApiError => e
    api_error_response(e)
  end
end

post "/double-optin/subscribe" do
  body = @json_body || {}
  email = body["email"]
  name = body["name"].to_s

  halt 400, json(error: "Missing required field: email") unless email

  confirm_url = "#{PUBLIC_URL}/double-optin/confirm?email=#{ERB::Util.url_encode(email)}&token=#{hmac(email)}"
  greeting = name.empty? ? "Welcome!" : "Welcome, #{name}!"

  begin
    # Stored as Transactional so it receives the confirmation but no campaigns yet
    CONTACTS_API.contacts_post(
      [
        ElasticEmail::ContactPayload.new(
          email: email,
          first_name: name.split(" ").first.to_s,
          status: "Transactional"
        )
      ]
    )

    result = EMAILS_API.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [email]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: "Confirm your subscription",
          body: [
            html_part(<<~HTML)
              <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
                <h1>#{greeting}</h1>
                <p>Please confirm your subscription to our newsletter.</p>
                <a href="#{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
              </div>
            HTML
          ]
        )
      )
    )

    json(success: true, message: "Confirmation email sent", messageId: result.message_id)
  rescue ElasticEmail::ApiError => e
    api_error_response(e)
  end
end

get "/double-optin/confirm" do
  email = params["email"].to_s
  token = params["token"].to_s

  if email.empty? || !Rack::Utils.secure_compare(hmac(email), token)
    halt 400, json(error: "Invalid confirmation link")
  end

  begin
    LISTS_API.lists_by_name_contacts_post(LIST_NAME, ElasticEmail::EmailsPayload.new(emails: [email]))
    redirect CONFIRM_REDIRECT_URL if CONFIRM_REDIRECT_URL && !CONFIRM_REDIRECT_URL.empty?
    json(confirmed: true, email: email, list: LIST_NAME)
  rescue ElasticEmail::ApiError => e
    api_error_response(e)
  end
end

# Click-tracking based confirmation: create a webhook for Clicked events pointing here.
# Verified like /webhook: signature when ELASTICEMAIL_WEBHOOK_SECRET is set, else ?token=.
def handle_double_optin_webhook
  event = webhook_event

  status_value = sanitize(event["status"])
  target = event["target"].to_s
  recipient = event["to"].to_s

  unless status_value == "Clicked" && target.include?("/double-optin/confirm")
    return json(received: true, status: status_value, message: "Event ignored")
  end

  begin
    LISTS_API.lists_by_name_contacts_post(LIST_NAME, ElasticEmail::EmailsPayload.new(emails: [recipient]))
    json(received: true, confirmed: true, email: sanitize(recipient))
  rescue ElasticEmail::ApiError => e
    api_error_response(e)
  end
end

get("/double-optin/webhook") { handle_double_optin_webhook }
post("/double-optin/webhook") { handle_double_optin_webhook }
