defmodule PhoenixAppWeb.WebhookController do
  use Phoenix.Controller, formats: [:json]
  import PhoenixAppWeb.Helpers
  require Logger

  # Elastic Email event notifications: transaction, messageid, to, from, subject, date, status,
  # category, channel, target (clicked URL), ip, useragent, country, city.
  # Signed webhooks (recommended, ELASTICEMAIL_WEBHOOK_SECRET set) are verified with HMAC-SHA256
  # and usually arrive as POST with a JSON body. Unsigned webhooks carry ?token= and send the
  # fields in the query string (GET) or as form fields (POST).
  # Elastic Email sends a test event when the webhook is saved.
  def handle(conn, _params) do
    case ElasticEmail.Webhook.read_event(conn) do
      {:ok, event} -> handle_event(conn, event)
      :error -> unauthorized(conn, "Invalid signature or token")
    end
  end

  defp handle_event(conn, params) do
    status = sanitize(params["status"])

    if status == "" do
      # Validation ping or empty request
      json(conn, %{ok: true})
    else
      Logger.info(
        "Webhook event: #{status} to: #{sanitize(params["to"])} transaction: #{sanitize(params["transaction"])}"
      )

      case status do
        "Sent" -> Logger.info("Email sent, message id: #{sanitize(params["messageid"])}")
        "Opened" -> Logger.info("Email opened from #{sanitize(params["country"])} #{sanitize(params["city"])}")
        "Clicked" -> Logger.info("Link clicked: #{sanitize(params["target"])}")
        "Error" -> Logger.info("Bounce/error, category: #{sanitize(params["category"])}")
        "AbuseReport" -> Logger.info("Complaint received")
        "Unsubscribed" -> Logger.info("Recipient unsubscribed")
        _ -> :ok
      end

      json(conn, %{received: true, status: status})
    end
  end
end
