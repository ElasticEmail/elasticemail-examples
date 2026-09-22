#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Suppressions
#
# Suppressions are split into unsubscribes, bounces and complaints.
# Adding to any list stops future sends to that address.
#
# Usage: ruby examples/suppressions.rb [email]

require_relative "ee"

suppressions_api = ElasticEmail::SuppressionsApi.new

email = ARGV[0] || "suppressed@example.com"

begin
  suppressions_api.suppressions_unsubscribes_post([email])
  puts "Added to unsubscribes: #{email}"
rescue ElasticEmail::ApiError => e
  api_error("add unsubscribe", e)
end

begin
  s = suppressions_api.suppressions_by_email_get(email)
  puts "Suppression: email=#{s.email} reason=#{s.friendly_error_message} date_updated=#{s.date_updated}"
rescue ElasticEmail::ApiError => e
  api_error("get suppression", e)
end

begin
  suppressions = suppressions_api.suppressions_get(limit: 10, offset: 0)
  puts "\nAll suppressions (first #{suppressions.length}):"
  suppressions.each { |s| puts " - #{s.email} #{s.friendly_error_message}" }
rescue ElasticEmail::ApiError => e
  api_error("list suppressions", e)
end

# Remove it again so the address can receive email
begin
  suppressions_api.suppressions_by_email_delete(email)
  puts "\nRemoved from suppressions: #{email}"
rescue ElasticEmail::ApiError => e
  api_error("delete suppression", e)
end
