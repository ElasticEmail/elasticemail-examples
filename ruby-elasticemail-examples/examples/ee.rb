# frozen_string_literal: true

##
# Shared setup for the standalone examples: loads .env, configures the SDK
# and exposes the env values every script needs.
#
# Usage in a script:
#   require_relative "ee"

require "bundler/setup"
require "ElasticEmail"
require "dotenv/load"
require "json"

API_KEY = ENV["ELASTICEMAIL_API_KEY"]
if API_KEY.nil? || API_KEY.empty?
  warn "ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env and add your API key."
  exit 1
end

ElasticEmail.configure do |config|
  config.api_key["X-ElasticEmail-ApiKey"] = API_KEY
end

FROM = ENV.fetch("EMAIL_FROM", "Acme <hello@yourdomain.com>")
TO = ENV.fetch("EMAIL_TO", "you@yourdomain.com")
CONTACT_EMAIL = ENV.fetch("CONTACT_EMAIL", FROM)
LIST_NAME = ENV.fetch("ELASTICEMAIL_LIST_NAME", "Newsletter")
TEMPLATE_NAME = ENV.fetch("ELASTICEMAIL_TEMPLATE_NAME", "welcome-example")
PUBLIC_URL = ENV.fetch("PUBLIC_URL", "http://localhost:3000")
WEBHOOK_TOKEN = ENV.fetch("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
SENDING_DOMAIN = ENV.fetch("SENDING_DOMAIN", "yourdomain.com")

# Prints the HTTP status and the API error body ({"Error": "..."}), then exits.
def api_error(step, e)
  warn "Error (#{step}): #{e.code} #{e.response_body || e.message}"
  exit 1
end

# Elastic Email answers 400 with an "already exists" message when a list or
# domain is created twice.
def already_exists?(e)
  e.code == 400 && e.response_body.to_s.match?(/exist|already/i)
end
