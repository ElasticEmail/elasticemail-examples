# frozen_string_literal: true

require "ElasticEmail"

api_key = ENV["ELASTICEMAIL_API_KEY"]
if api_key.nil? || api_key.empty?
  abort "ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env and add your API key."
end

ElasticEmail.configure do |config|
  config.api_key["X-ElasticEmail-ApiKey"] = api_key
end
