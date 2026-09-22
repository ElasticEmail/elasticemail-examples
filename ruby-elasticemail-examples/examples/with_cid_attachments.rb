#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Email with CID (Inline) Attachments Example
#
# Elastic Email derives the Content-ID of an attachment from its file name.
# Reference the attachment Name after "cid:" to embed it inline.
#
# Usage: ruby examples/with_cid_attachments.rb

require_relative "ee"

emails_api = ElasticEmail::EmailsApi.new

# Minimal 1x1 PNG placeholder (base64-encoded)
PLACEHOLDER_IMAGE =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

html = <<~HTML
  <div style="font-family: Arial, sans-serif; padding: 20px;">
    <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
    <h1>Welcome!</h1>
    <p>This email contains an inline image referenced by Content-ID.</p>
  </div>
HTML

begin
  result = emails_api.emails_transactional_post(
    ElasticEmail::EmailTransactionalMessageData.new(
      recipients: ElasticEmail::TransactionalRecipient.new(to: [TO]),
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        subject: "Email with Inline Image",
        body: [ElasticEmail::BodyPart.new(content_type: "HTML", content: html)],
        attachments: [
          ElasticEmail::MessageAttachment.new(
            binary_content: PLACEHOLDER_IMAGE,
            name: "logo.png",
            content_type: "image/png"
          )
        ]
      )
    )
  )

  puts "Email with inline image sent successfully!"
  puts "Transaction ID: #{result.transaction_id}"
  puts "Message ID: #{result.message_id}"
rescue ElasticEmail::ApiError => e
  api_error("send email", e)
end
