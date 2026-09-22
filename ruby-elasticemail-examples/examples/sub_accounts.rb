#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Sub-Accounts
#
# Sub-accounts let you isolate customers or projects with their own API keys and credits.
# Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
#
# Usage:
#   ruby examples/sub_accounts.rb
#   CREATE_SUBACCOUNT=true ruby examples/sub_accounts.rb

require_relative "ee"
require "securerandom"

sub_accounts_api = ElasticEmail::SubAccountsApi.new

create_enabled = ENV["CREATE_SUBACCOUNT"] == "true"
sub_email = ENV.fetch("SUBACCOUNT_EMAIL", "sub-#{Time.now.to_i}@example.com")

begin
  accounts = sub_accounts_api.subaccounts_get(limit: 20, offset: 0)
  puts "Sub-accounts (#{accounts.length}):"
  accounts.each do |s|
    puts " - #{s.email} status=#{s.status} credits=#{s.email_credits} sent=#{s.total_emails_sent}"
  end
rescue ElasticEmail::ApiError => e
  api_error("list sub-accounts", e)
end

unless create_enabled
  puts "\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits."
  exit 0
end

begin
  account = sub_accounts_api.subaccounts_post(
    ElasticEmail::SubaccountPayload.new(
      email: sub_email,
      password: "Tmp-#{SecureRandom.alphanumeric(12)}-Aa1!",
      send_activation: false
    )
  )
  puts "\nSub-account created: #{account.email}"

  sub_accounts_api.subaccounts_by_email_credits_patch(
    sub_email,
    ElasticEmail::SubaccountEmailCreditsPayload.new(credits: 1000, notes: "Initial allocation")
  )
  puts "Assigned 1000 credits to #{sub_email}"

  key = sub_accounts_api.subaccounts_by_email_apikey_get(sub_email)
  puts "Sub-account API key retrieved (length): #{key.to_s.length}"
rescue ElasticEmail::ApiError => e
  api_error("create sub-account", e)
end
