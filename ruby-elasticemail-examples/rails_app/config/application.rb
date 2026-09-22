# frozen_string_literal: true

require_relative "boot"

require "rails"
require "action_controller/railtie"

Bundler.require(*Rails.groups)

# The shared .env lives one level up (next to the standalone examples).
# Values already present in the environment are not overwritten.
Dotenv.load(File.expand_path("../../.env", __dir__))

module RailsElasticEmailExample
  class Application < Rails::Application
    config.load_defaults 7.2

    # API-only mode
    config.api_only = true

    # Don't generate system test files
    config.generators.system_tests = nil
  end
end
