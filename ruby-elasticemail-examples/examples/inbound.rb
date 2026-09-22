#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Inbound Route Management
#
# Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
# Matching emails are parsed and POSTed as form fields to HttpAddress
# (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
# See sinatra_app/app.rb for the receiving handler.
#
# Usage: ruby examples/inbound.rb

require_relative "ee"
require "erb"

inbound_api = ElasticEmail::InboundRouteApi.new

route_id = nil
begin
  route = inbound_api.inboundroute_post(
    ElasticEmail::InboundPayload.new(
      name: "examples-inbound",
      filter: "*@#{SENDING_DOMAIN}",
      filter_type: "EmailAddress",
      action_type: "NotifyViaHttp",
      http_address: "#{PUBLIC_URL}/inbound?token=#{ERB::Util.url_encode(WEBHOOK_TOKEN)}"
    )
  )
  route_id = route.public_id
  puts "Inbound route created: #{route_id} #{route.filter} -> #{route.action_parameter}"
rescue ElasticEmail::ApiError => e
  api_error("create route", e)
end

begin
  routes = inbound_api.inboundroute_get
  puts "\nInbound routes (#{routes.length}):"
  routes.each do |r|
    puts " - [#{r.sort_order}] #{r.public_id} #{r.name}: #{r.filter_type}=#{r.filter} #{r.action_type} #{r.action_parameter}"
  end
rescue ElasticEmail::ApiError => e
  api_error("list routes", e)
end

# Delete the route we created (comment out to keep it)
if route_id
  begin
    inbound_api.inboundroute_by_id_delete(route_id)
    puts "\nInbound route deleted: #{route_id}"
  rescue ElasticEmail::ApiError => e
    api_error("delete route", e)
  end
end
