#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Webhook Management
#
# Elastic Email does not sign webhook requests. The examples append a shared secret
# as a query parameter and the receiving handler checks it.
#
# Usage: ruby examples/webhooks.rb

require_relative "ee"
require "erb"

webhook_api = ElasticEmail::WebhookApi.new

webhook_url = "#{PUBLIC_URL}/webhook?token=#{ERB::Util.url_encode(WEBHOOK_TOKEN)}"

# 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
#    and answer 2xx (use a tunnel such as ngrok for local development).
webhook_id = nil
begin
  webhook = webhook_api.webhook_post(
    ElasticEmail::WebhookCreatePayload.new(
      name: "examples-webhook",
      url: webhook_url,
      notify_once_per_email: false,
      notification_for_sent: true,
      notification_for_opened: true,
      notification_for_clicked: true,
      notification_for_unsubscribed: true,
      notification_for_abuse_report: true,
      notification_for_error: true
    )
  )
  webhook_id = webhook.webhook_id
  puts "Webhook created: #{webhook_id} #{webhook.url}"
rescue ElasticEmail::ApiError => e
  api_error("create webhook", e)
end

# 2. List
begin
  webhooks = webhook_api.webhook_get(limit: 50, offset: 0)
  puts "\nWebhooks (#{webhooks.length}):"
  webhooks.each do |w|
    puts " - #{w.webhook_id} #{w.name} #{w.url} enabled=#{w.is_enabled}"
  end
rescue ElasticEmail::ApiError => e
  api_error("list webhooks", e)
end

# 3. Delete the one we created (comment out to keep it)
if webhook_id
  begin
    webhook_api.webhook_by_publicid_delete(webhook_id)
    puts "\nWebhook deleted: #{webhook_id}"
  rescue ElasticEmail::ApiError => e
    api_error("delete webhook", e)
  end
end
