#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Batch Sending Example
#
# Bulk send: one API call, one personalized email per recipient.
# Values from each recipient's Fields replace {placeholders} in the subject and body.
# Up to 1000 recipients per request.
#
# Usage: ruby examples/batch_send.rb

require_relative "ee"

emails_api = ElasticEmail::EmailsApi.new

recipients = [
  ElasticEmail::EmailRecipient.new(email: TO, fields: { "firstname" => "Ann", "plan" => "Pro" }),
  ElasticEmail::EmailRecipient.new(email: TO, fields: { "firstname" => "Ben", "plan" => "Starter" }),
  ElasticEmail::EmailRecipient.new(email: TO, fields: { "firstname" => "Cleo", "plan" => "Team" })
]

begin
  result = emails_api.emails_post(
    ElasticEmail::EmailMessageData.new(
      recipients: recipients,
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        subject: "Hi {firstname}, your {plan} plan is ready",
        body: [
          ElasticEmail::BodyPart.new(
            content_type: "HTML",
            content: "<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>"
          ),
          ElasticEmail::BodyPart.new(
            content_type: "PlainText",
            content: "Hi {firstname}! Your {plan} plan is now active."
          )
        ]
      )
    )
  )

  puts "Bulk email queued for #{recipients.length} recipients."
  puts "Transaction ID: #{result.transaction_id}"
  puts "Check delivery with: ruby examples/email_status.rb #{result.transaction_id}"
rescue ElasticEmail::ApiError => e
  api_error("send bulk email", e)
end
