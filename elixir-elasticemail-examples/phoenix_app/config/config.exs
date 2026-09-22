import Config

config :phoenix_app, PhoenixAppWeb.Endpoint,
  adapter: Bandit.PhoenixAdapter,
  http: [ip: {0, 0, 0, 0}, port: 3000],
  server: true,
  secret_key_base: String.duplicate("a", 64),
  render_errors: [formats: [json: PhoenixAppWeb.ErrorJSON], layout: false]

config :phoenix, :json_library, Jason

config :logger, level: :info
