#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Prevent Gmail Threading Example
#
# Gmail groups emails into threads based on subject and Message-ID/References headers.
# A unique X-Entity-Ref-ID header per email prevents this grouping.
#
# Usage: ruby examples/prevent_threading.rb

require_relative "ee"
require "securerandom"

emails_api = ElasticEmail::EmailsApi.new

(1..3).each do |i|
  begin
    result = emails_api.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [TO]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: "Order Confirmation", # Same subject for all
          body: [
            ElasticEmail::BodyPart.new(
              content_type: "HTML",
              content: "<h1>Order Confirmation</h1><p>This is email ##{i}. Each appears as a separate conversation in Gmail.</p>"
            )
          ],
          headers: { "X-Entity-Ref-ID" => SecureRandom.uuid }
        )
      )
    )

    puts "Email ##{i} sent: #{result.message_id}"
  rescue ElasticEmail::ApiError => e
    api_error("send email ##{i}", e)
  end
end

puts "\nAll emails sent with unique X-Entity-Ref-ID headers."
