defmodule PhoenixAppWeb.Helpers do
  @moduledoc "Shared helpers for token checks, HMAC and API error responses."

  import Plug.Conn
  import Phoenix.Controller, only: [json: 2]

  @doc "Constant-time comparison of the shared secret carried in ?token="
  def token_ok?(token) do
    Plug.Crypto.secure_compare(to_string(token || ""), ElasticEmail.Env.webhook_token())
  end

  def hmac(value) do
    :crypto.mac(:hmac, :sha256, ElasticEmail.Env.webhook_token(), value)
    |> Base.encode16(case: :lower)
  end

  @doc "Strip newlines from user-controlled values before logging"
  def sanitize(nil), do: ""
  def sanitize(value), do: value |> to_string() |> String.replace(~r/[\r\n]/, "")

  @doc "Render `{\"error\": message}` with the API status code (500 for transport failures)."
  def api_error(conn, {:error, status, _body} = error) do
    http_status = if status in 400..599, do: status, else: 500

    conn
    |> put_status(http_status)
    |> json(%{error: ElasticEmail.error_message(error)})
  end

  def unauthorized(conn) do
    conn |> put_status(401) |> json(%{error: "Invalid token"})
  end
end
