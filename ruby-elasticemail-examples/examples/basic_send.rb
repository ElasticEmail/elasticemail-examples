#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Basic Email Sending Example
#
# Sends a single transactional email with HTML and plain text parts.
#
# Usage: ruby examples/basic_send.rb

require_relative "ee"

emails_api = ElasticEmail::EmailsApi.new

begin
  # The From address must belong to a verified domain.
  result = emails_api.emails_transactional_post(
    ElasticEmail::EmailTransactionalMessageData.new(
      recipients: ElasticEmail::TransactionalRecipient.new(to: [TO]),
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        subject: "Hello from Elastic Email!",
        body: [
          ElasticEmail::BodyPart.new(
            content_type: "HTML",
            content: "<h1>Welcome!</h1><p>This email was sent using the Elastic Email Ruby SDK.</p>"
          ),
          ElasticEmail::BodyPart.new(
            content_type: "PlainText",
            content: "Welcome! This email was sent using the Elastic Email Ruby SDK."
          )
        ]
      )
    )
  )

  puts "Email sent successfully!"
  puts "Transaction ID: #{result.transaction_id}"
  puts "Message ID: #{result.message_id}"
rescue ElasticEmail::ApiError => e
  api_error("send email", e)
end
