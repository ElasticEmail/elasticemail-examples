import Config

# Compile-time defaults. Real values come from config/runtime.exs (.env + System.get_env).
config :elasticemail_examples,
  api_key: System.get_env("ELASTICEMAIL_API_KEY"),
  from: System.get_env("EMAIL_FROM"),
  to: System.get_env("EMAIL_TO")

config :logger, level: :info
