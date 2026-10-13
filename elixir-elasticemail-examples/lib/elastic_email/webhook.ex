defmodule ElasticEmail.Webhook do
  @moduledoc """
  Verification of incoming Elastic Email webhook requests.

  Webhooks created with `"EnableSigning" => true` carry three headers:
  `X-ElasticEmail-Timestamp` (unix seconds), `X-ElasticEmail-Signature`
  (`v1=<lowercase hex>`, possibly several comma-separated entries) and
  `X-ElasticEmail-Webhook-Id`. The signature is HMAC-SHA256, keyed with the
  signing secret, over `"{timestamp}\\n{METHOD}\\n{request target}\\n{raw body}"`.

  The raw body must be captured before it is parsed: pass
  `body_reader: {ElasticEmail.Webhook, :read_body, []}` to `Plug.Parsers`.
  """

  @tolerance_seconds 300

  @doc """
  Returns true when one of the `v1=` entries in `signature_header` matches and the
  timestamp is within 5 minutes of `now`. `target` is path + query exactly as received
  (still URL-encoded), `body` the raw body (`""` for GET).
  """
  def verify_signature(secret, timestamp, signature_header, method, target, body, now \\ nil)

  def verify_signature(secret, timestamp, signature_header, method, target, body, now)
      when is_binary(secret) and is_binary(timestamp) and is_binary(signature_header) do
    now = now || System.system_time(:second)

    with {ts, ""} <- Integer.parse(timestamp),
         true <- abs(now - ts) <= @tolerance_seconds do
      expected =
        :crypto.mac(:hmac, :sha256, secret, [timestamp, "\n", method, "\n", target, "\n", body])
        |> Base.encode16(case: :lower)

      signature_header
      |> String.split(",")
      |> Enum.map(&String.trim/1)
      |> Enum.any?(fn
        "v1=" <> signature -> Plug.Crypto.secure_compare(expected, signature)
        _ -> false
      end)
    else
      _ -> false
    end
  end

  def verify_signature(_secret, _timestamp, _signature_header, _method, _target, _body, _now),
    do: false

  @doc """
  Reads a webhook event from a `Plug.Conn` whose body went through `Plug.Parsers`.

  With `ELASTICEMAIL_WEBHOOK_SECRET` set, the request must carry a valid signature and
  the event comes from the JSON body (POST) or the query string (GET). Without it, the
  `?token=` shared secret (`ELASTICEMAIL_WEBHOOK_TOKEN`) is checked and query and form
  fields are merged, as for unsigned webhooks.

  Returns `{:ok, event}` with lowercase keys, or `:error` when the request is not authentic.
  """
  def read_event(conn) do
    conn = Plug.Conn.fetch_query_params(conn)

    case ElasticEmail.Env.webhook_secret() do
      nil -> read_token_event(conn)
      secret -> read_signed_event(conn, secret)
    end
  end

  @doc "`Plug.Parsers` body reader that keeps the raw body in `conn.assigns.raw_body`."
  def read_body(conn, opts) do
    case Plug.Conn.read_body(conn, opts) do
      {status, chunk, conn} when status in [:ok, :more] ->
        raw = (conn.assigns[:raw_body] || "") <> chunk
        {status, chunk, Plug.Conn.assign(conn, :raw_body, raw)}

      other ->
        other
    end
  end

  defp read_token_event(conn) do
    token = to_string(conn.query_params["token"] || "")

    if Plug.Crypto.secure_compare(token, ElasticEmail.Env.webhook_token()) do
      body_params =
        case conn.body_params do
          %Plug.Conn.Unfetched{} -> %{}
          params -> params
        end

      {:ok, downcase_keys(Map.merge(conn.query_params, body_params))}
    else
      :error
    end
  end

  defp read_signed_event(conn, secret) do
    body = raw_body(conn)

    # Request target exactly as received: Plug keeps request_path and query_string encoded
    target =
      if conn.query_string == "",
        do: conn.request_path,
        else: conn.request_path <> "?" <> conn.query_string

    timestamp = conn |> Plug.Conn.get_req_header("x-elasticemail-timestamp") |> List.first("")
    signature = conn |> Plug.Conn.get_req_header("x-elasticemail-signature") |> Enum.join(",")

    if verify_signature(secret, timestamp, signature, conn.method, target, body) do
      event = if conn.method == "GET", do: conn.query_params, else: decode_json(body)
      {:ok, downcase_keys(event)}
    else
      :error
    end
  end

  defp raw_body(%Plug.Conn{assigns: %{raw_body: body}}), do: body

  # Content types Plug.Parsers passed through unread
  defp raw_body(conn) do
    case Plug.Conn.read_body(conn) do
      {:ok, body, _conn} -> body
      _ -> ""
    end
  end

  # PostJson: a flat JSON object with the same field names as the GET parameters
  defp decode_json(""), do: %{}

  defp decode_json(body) do
    case Jason.decode(body) do
      {:ok, %{} = event} -> event
      _ -> %{}
    end
  end

  defp downcase_keys(map), do: Map.new(map, fn {k, v} -> {String.downcase(to_string(k)), v} end)
end
