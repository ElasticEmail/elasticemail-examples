#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Scheduled Sending Example
#
# TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
# Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
#
# Usage: ruby examples/scheduled_send.rb

require_relative "ee"

emails_api = ElasticEmail::EmailsApi.new

delay_minutes = 60
scheduled_for = (Time.now + delay_minutes * 60).utc.iso8601

begin
  result = emails_api.emails_transactional_post(
    ElasticEmail::EmailTransactionalMessageData.new(
      recipients: ElasticEmail::TransactionalRecipient.new(to: [TO]),
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        subject: "Scheduled Email",
        body: [
          ElasticEmail::BodyPart.new(
            content_type: "HTML",
            content: "<h1>Scheduled Email</h1><p>This email was scheduled for #{scheduled_for}.</p>"
          )
        ]
      ),
      options: ElasticEmail::Options.new(time_offset: delay_minutes)
    )
  )

  puts "Email scheduled for #{scheduled_for}"
  puts "Transaction ID: #{result.transaction_id}"
  puts "Message ID: #{result.message_id}"
rescue ElasticEmail::ApiError => e
  api_error("schedule email", e)
end
