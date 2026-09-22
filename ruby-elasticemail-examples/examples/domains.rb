#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Domain Management
#
# Adds a sending domain and prints its DNS verification state.
#
# Usage: ruby examples/domains.rb

require_relative "ee"

domains_api = ElasticEmail::DomainsApi.new

domain = SENDING_DOMAIN

# 1. Add the domain
begin
  domains_api.domains_post(ElasticEmail::DomainPayload.new(domain: domain))
  puts "Domain \"#{domain}\" added."
rescue ElasticEmail::ApiError => e
  if already_exists?(e)
    puts "Domain \"#{domain}\" already exists."
  else
    api_error("add domain", e)
  end
end

# 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
begin
  data = domains_api.domains_by_domain_get(domain)
  puts "\nVerification status:"
  puts "  SPF:       #{data.spf ? 'ok' : 'missing'}"
  puts "  DKIM:      #{data.dkim ? 'ok' : 'missing'}"
  puts "  MX:        #{data.mx ? 'ok' : 'missing'}"
  puts "  DMARC:     #{data.dmarc ? 'ok' : 'missing'}"
  puts "  Tracking:  #{data.tracking_status || 'n/a'}"
  puts "  Default:   #{data.default_domain ? 'yes' : 'no'}"
  if data.dkim_record
    puts "\nDKIM record to publish: #{data.dkim_record.to_hash.to_json}"
  end
rescue ElasticEmail::ApiError => e
  api_error("get domain", e)
end

# 3. List all domains
begin
  domains = domains_api.domains_get
  puts "\nDomains on the account (#{domains.length}):"
  domains.each do |d|
    puts " - #{d.domain} spf=#{d.spf} dkim=#{d.dkim} default=#{d.default_domain}"
  end
rescue ElasticEmail::ApiError => e
  api_error("list domains", e)
end

# 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
# domains_api.domains_by_domain_verification_put(domain, "Http")

# 5. Optional: set the default sender for the account
# domains_api.domains_by_email_default_patch("hello@#{domain}")

puts "\nDone."
