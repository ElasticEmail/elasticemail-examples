#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Email Status
#
# Both ids are returned by every send call.
#
# Usage: ruby examples/email_status.rb <transactionId> [messageId]

require_relative "ee"

emails_api = ElasticEmail::EmailsApi.new

transaction_id, message_id = ARGV

unless transaction_id
  warn "Usage: ruby examples/email_status.rb <transactionId> [messageId]"
  exit 1
end

begin
  data = emails_api.emails_by_transactionid_status_get(
    transaction_id,
    show_failed: true,
    show_sent: true,
    show_delivered: true,
    show_pending: true,
    show_opened: true,
    show_clicked: true
  )

  puts "=== Transaction status ==="
  puts "Status:      #{data.status}"
  puts "Recipients:  #{data.recipients_count}"
  puts "Sent:        #{data.sent_count} #{(data.sent || []).inspect}"
  puts "Delivered:   #{data.delivered_count} #{(data.delivered || []).inspect}"
  puts "Pending:     #{data.pending_count}"
  puts "Opened:      #{data.opened_count}"
  puts "Clicked:     #{data.clicked_count}"
  puts "Failed:      #{data.failed_count} #{(data.failed || []).map(&:to_hash).inspect}"
rescue ElasticEmail::ApiError => e
  api_error("fetch status", e)
end

if message_id
  begin
    data = emails_api.emails_by_msgid_view_get(message_id)
    puts "\n=== Message ==="
    puts "From:     #{data.preview&.from}"
    puts "Subject:  #{data.preview&.subject}"
    puts "Status:   #{data.status&.status_name} #{data.status&.date_sent}"
    body = data.preview&.body.to_s
    puts "Body preview: #{body.length > 200 ? "#{body[0, 200]}..." : body}"
  rescue ElasticEmail::ApiError => e
    warn "Error fetching message: #{e.code} #{e.response_body || e.message}"
  end
end
