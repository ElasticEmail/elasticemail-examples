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
#   GET|POST /webhook?token=...
#   POST /inbound?token=...
#   POST /double-optin/subscribe
#   GET  /double-optin/confirm?email=&token=
#   POST /double-optin/webhook?token=...

require "bundler/setup"
require "sinatra"
require "sinatra/json"
require "ElasticEmail"
require "dotenv/load"
require "json"
require "openssl"
require "erb"
require "rack/utils"

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
CONFIRM_REDIRECT_URL = ENV["CONFIRM_REDIRECT_URL"]

set :port, ENV.fetch("PORT", 3000).to_i
set :bind, "0.0.0.0"

EMAILS_API = ElasticEmail::EmailsApi.new
CONTACTS_API = ElasticEmail::ContactsApi.new
LISTS_API = ElasticEmail::ListsApi.new

# Elastic Email webhooks and inbound notifications are form-encoded; the other
# routes take JSON. Parse JSON bodies into @json_body.
before do
  content_type :json

  if request.content_type&.include?("application/json")
    body = request.body.read
    @json_body = body.empty? ? {} : JSON.parse(body)
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

  begin
    result = EMAILS_API.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [to]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: subject,
          body: [html_part("<p>#{message}</p>")]
        )
      )
    )
    json(success: true, transactionId: result.transaction_id, messageId: result.message_id)
  rescue ElasticEmail::ApiError => e
    api_error_response(e)
  end
end

# Elastic Email event notifications. Parameters arrive in the query string (GET) or as
# form fields (POST): transaction, messageid, to, from, subject, date, status, category,
# channel, target (clicked URL), IP, Useragent, Country, City.
# Elastic Email sends a GET to validate the URL when the webhook is saved.
def handle_webhook
  halt 401, json(error: "Invalid token") unless token_ok?(params["token"])

  status_value = sanitize(params["status"])

  # Validation ping or empty request
  return json(ok: true) if status_value.empty?

  puts "Webhook event: #{status_value} to: #{sanitize(params['to'])} transaction: #{sanitize(params['transaction'])}"

  case status_value
  when "Sent"
    puts "Email sent, message id: #{sanitize(params['messageid'])}"
  when "Opened"
    puts "Email opened from #{sanitize(params['Country'])} #{sanitize(params['City'])}"
  when "Clicked"
    puts "Link clicked: #{sanitize(params['target'])}"
  when "Error"
    puts "Bounce/error, category: #{sanitize(params['category'])}"
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
post "/double-optin/webhook" do
  halt 401, json(error: "Invalid token") unless token_ok?(params["token"])

  status_value = sanitize(params["status"])
  target = params["target"].to_s
  recipient = params["to"].to_s

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
