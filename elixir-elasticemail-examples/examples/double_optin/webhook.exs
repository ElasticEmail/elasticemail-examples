# Alternative confirmation flow driven by Elastic Email click tracking.
# Create a webhook (see webhooks.exs) pointing at /double-optin/webhook.
# Signed webhooks are verified with ELASTICEMAIL_WEBHOOK_SECRET; unsigned ones carry ?token=.
# When the recipient clicks the confirm link, Elastic Email reports status=Clicked
# with the clicked URL in "target". The contact is then added to the list.
#
# Run with: mix run examples/double_optin/webhook.exs

defmodule DoubleOptinWebhook do
  use Plug.Router

  # The body reader keeps the raw body for the signature check
  plug Plug.Parsers,
    parsers: [:urlencoded, :json],
    pass: ["*/*"],
    json_decoder: Jason,
    body_reader: {ElasticEmail.Webhook, :read_body, []}

  plug :match
  plug :dispatch

  # Elastic Email sends a test event when the webhook is saved; GET is accepted too.
  match "/double-optin/webhook", via: [:get, :post] do
    case ElasticEmail.Webhook.read_event(conn) do
      {:ok, event} -> handle_event(conn, event)
      :error -> send_json(conn, 401, %{error: "Invalid signature or token"})
    end
  end

  match _ do
    send_json(conn, 404, %{error: "Not found"})
  end

  defp handle_event(conn, event) do
    status = sanitize(event["status"])
    target = sanitize(event["target"])
    recipient = sanitize(event["to"])
    list_name = ElasticEmail.Env.list_name()

    if status != "Clicked" or not String.contains?(target, "/double-optin/confirm") do
      send_json(conn, 200, %{received: true, status: status, message: "Event ignored"})
    else
      case ElasticEmail.post("/lists/#{ElasticEmail.path_segment(list_name)}/contacts", %{
             "Emails" => [recipient]
           }) do
        {:ok, _} ->
          IO.puts("Subscription confirmed via click: #{recipient}")
          send_json(conn, 200, %{received: true, confirmed: true, email: recipient, list: list_name})

        error ->
          IO.puts(:stderr, "Error adding contact to list: #{ElasticEmail.format_error(error)}")
          send_json(conn, 500, %{error: ElasticEmail.error_message(error)})
      end
    end
  end

  defp sanitize(nil), do: ""
  defp sanitize(value), do: value |> to_string() |> String.replace(~r/[\r\n]/, "")

  defp send_json(conn, status, body) do
    conn
    |> put_resp_content_type("application/json")
    |> send_resp(status, Jason.encode!(body))
  end
end

port = ElasticEmail.Env.port(3000)
{:ok, _} = Bandit.start_link(plug: DoubleOptinWebhook, port: port)
IO.puts("Double opt-in webhook listening on http://localhost:#{port}/double-optin/webhook")
Process.sleep(:infinity)
