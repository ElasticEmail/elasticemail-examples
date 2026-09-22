#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Email Verification
#
# Email verification is a paid feature. Accounts without it get a 4xx here.
#
# Usage: ruby examples/email_verification.rb someone@example.com

require_relative "ee"

verifications_api = ElasticEmail::VerificationsApi.new

email = ARGV[0] || TO

begin
  verifications_api.verifications_by_email_post(email)
  data = verifications_api.verifications_by_email_get(email)

  puts "=== Verification result ==="
  puts "Email:       #{data.email}"
  puts "Result:      #{data.result}"
  puts "Reason:      #{data.reason}"
  puts "Disposable:  #{data.disposable}"
  puts "Role:        #{data.role}"
  puts "Did you mean: #{data.suggested_spelling}" if data.suggested_spelling
rescue ElasticEmail::ApiError => e
  api_error("verify email", e)
end
