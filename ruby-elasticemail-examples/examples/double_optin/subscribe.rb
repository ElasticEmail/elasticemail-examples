#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Double Opt-In: Subscribe
#
# Stores the contact with status Transactional (not on the marketing list yet)
# and sends a confirmation email. The confirm link carries an HMAC of the email
# so the confirm endpoint can trust it.
#
# Usage: ruby examples/double_optin/subscribe.rb user@example.com "John Doe"

require_relative "../ee"
require "openssl"
require "erb"

contacts_api = ElasticEmail::ContactsApi.new
emails_api = ElasticEmail::EmailsApi.new

email = ARGV[0]
name = ARGV[1].to_s

unless email
  warn "Usage: ruby examples/double_optin/subscribe.rb <email> [\"Name\"]"
  exit 1
end

confirm_token = OpenSSL::HMAC.hexdigest("SHA256", WEBHOOK_TOKEN, email)
confirm_url = "#{PUBLIC_URL}/double-optin/confirm?email=#{ERB::Util.url_encode(email)}&token=#{confirm_token}"

first_name, *rest = name.split(" ")
greeting = name.empty? ? "Welcome!" : "Welcome, #{name}!"

begin
  # Step 1: store the contact without adding it to the marketing list.
  # Status "Transactional" allows sending the confirmation but excludes it from campaigns.
  contacts_api.contacts_post(
    [
      ElasticEmail::ContactPayload.new(
        email: email,
        first_name: first_name.to_s,
        last_name: rest.join(" "),
        status: "Transactional"
      )
    ]
  )
  puts "Contact stored (unconfirmed): #{email}"

  # Step 2: send the confirmation email
  result = emails_api.emails_transactional_post(
    ElasticEmail::EmailTransactionalMessageData.new(
      recipients: ElasticEmail::TransactionalRecipient.new(to: [email]),
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        subject: "Confirm your subscription",
        body: [
          ElasticEmail::BodyPart.new(
            content_type: "HTML",
            content: <<~HTML
              <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
                <h1>#{greeting}</h1>
                <p>Please confirm your subscription to our newsletter.</p>
                <a href="#{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
              </div>
            HTML
          ),
          ElasticEmail::BodyPart.new(
            content_type: "PlainText",
            content: "#{greeting}\n\nConfirm your subscription: #{confirm_url}"
          )
        ]
      )
    )
  )

  puts "Confirmation email sent. Message ID: #{result.message_id}"
  puts "Confirm URL: #{confirm_url}"
  puts "\nWhen the link is opened, GET /double-optin/confirm in sinatra_app/app.rb adds the contact to the list."
rescue ElasticEmail::ApiError => e
  api_error("subscribe", e)
end
