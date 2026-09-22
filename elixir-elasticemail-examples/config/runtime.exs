import Config

# Minimal .env loader: KEY=VALUE lines, "#" comments, optional surrounding quotes.
# Variables already present in the environment are not overwritten.
if File.exists?(".env") do
  ".env"
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

blank_to_nil = fn
  nil -> nil
  "" -> nil
  value -> value
end

config :elasticemail_examples,
  api_key:
    System.get_env("ELASTICEMAIL_API_KEY") ||
      raise("ELASTICEMAIL_API_KEY environment variable is required"),
  from: blank_to_nil.(System.get_env("EMAIL_FROM")),
  to: blank_to_nil.(System.get_env("EMAIL_TO")),
  contact_email: blank_to_nil.(System.get_env("CONTACT_EMAIL")),
  webhook_token: blank_to_nil.(System.get_env("ELASTICEMAIL_WEBHOOK_TOKEN")),
  list_name: blank_to_nil.(System.get_env("ELASTICEMAIL_LIST_NAME")),
  template_name: blank_to_nil.(System.get_env("ELASTICEMAIL_TEMPLATE_NAME")),
  public_url: blank_to_nil.(System.get_env("PUBLIC_URL")),
  sending_domain: blank_to_nil.(System.get_env("SENDING_DOMAIN")),
  confirm_redirect_url: blank_to_nil.(System.get_env("CONFIRM_REDIRECT_URL")),
  port: blank_to_nil.(System.get_env("PORT"))
