defmodule PhoenixAppWeb.WebhookController do
  use Phoenix.Controller, formats: [:json]
  import PhoenixAppWeb.Helpers
  require Logger

  # Elastic Email event notifications. Parameters arrive in the query string (GET) or as
  # form fields (POST): transaction, messageid, to, from, subject, date, status, category,
  # channel, target (clicked URL), IP, Useragent, Country, City.
  # Elastic Email sends a GET to validate the URL when the webhook is saved.
  def handle(conn, params) do
    if token_ok?(params["token"]) do
      handle_event(conn, params)
    else
      unauthorized(conn)
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
        "Opened" -> Logger.info("Email opened from #{sanitize(params["Country"])} #{sanitize(params["City"])}")
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
