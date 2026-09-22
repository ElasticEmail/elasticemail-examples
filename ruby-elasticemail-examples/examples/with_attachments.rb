#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Email with Attachments Example
#
# Usage: ruby examples/with_attachments.rb

require_relative "ee"
require "base64"

emails_api = ElasticEmail::EmailsApi.new

file_content = <<~TEXT
  Sample Attachment
  ==================

  This file was attached to your email.
  Sent at: #{Time.now.utc.iso8601}
TEXT
encoded = Base64.strict_encode64(file_content)

begin
  result = emails_api.emails_transactional_post(
    ElasticEmail::EmailTransactionalMessageData.new(
      recipients: ElasticEmail::TransactionalRecipient.new(to: [TO]),
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        subject: "Email with Attachment",
        body: [
          ElasticEmail::BodyPart.new(
            content_type: "HTML",
            content: "<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>"
          )
        ],
        # BinaryContent is base64. Total message size limit applies (see account limits).
        attachments: [
          ElasticEmail::MessageAttachment.new(
            binary_content: encoded,
            name: "sample.txt",
            content_type: "text/plain"
          )
        ]
      )
    )
  )

  puts "Email with attachment sent successfully!"
  puts "Transaction ID: #{result.transaction_id}"
  puts "Message ID: #{result.message_id}"
rescue ElasticEmail::ApiError => e
  api_error("send email", e)
end
