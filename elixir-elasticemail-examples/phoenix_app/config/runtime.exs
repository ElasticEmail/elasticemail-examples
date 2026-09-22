import Config

# Minimal .env loader. Looks in the parent folder first (shared with the standalone
# examples), then in this folder. Variables already in the environment win.
env_file = Enum.find(["../.env", ".env"], &File.exists?/1)

if env_file do
  env_file
  |> File.read!()
  |> String.split(["\r\n", "\n"], trim: true)
  |> Enum.each(fn line ->
    line = String.trim(line)

    with false <- String.starts_with?(line, "#"),
         [key, value] <- String.split(line, "=", parts: 2) do
      key = String.trim(key)
      value = value |> String.trim() |> String.trim("\"") |> String.trim("'")

      if System.get_env(key) in [nil, ""], do: System.put_env(key, value)
    else
      _ -> :ok
    end
  end)
end

config :elasticemail_examples,
  api_key:
    System.get_env("ELASTICEMAIL_API_KEY") ||
      raise("ELASTICEMAIL_API_KEY environment variable is required")

port = String.to_integer(System.get_env("PORT") || "3000")

config :phoenix_app, PhoenixAppWeb.Endpoint, http: [ip: {0, 0, 0, 0}, port: port]
