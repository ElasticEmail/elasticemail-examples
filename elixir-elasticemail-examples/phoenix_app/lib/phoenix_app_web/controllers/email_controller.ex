defmodule PhoenixAppWeb.EmailController do
  use Phoenix.Controller, formats: [:json]
  import PhoenixAppWeb.Helpers

  def send_email(conn, %{"to" => to, "subject" => subject, "message" => message})
      when to != "" and subject != "" and message != "" do
    # Forward the client's Idempotency-Key so its retries can't send twice; otherwise use a new one.
    idempotency_key =
      case get_req_header(conn, "idempotency-key") do
        [key | _] when key != "" -> key
        _ -> ElasticEmail.new_idempotency_key()
      end

    case ElasticEmail.send_transactional(
           %{
             "Recipients" => %{"To" => [to]},
             "Content" => %{
               "From" => ElasticEmail.Env.from(),
               "Subject" => subject,
               "Body" => [%{"ContentType" => "HTML", "Content" => "<p>#{message}</p>"}]
             }
           },
           idempotency_key
         ) do
      {:ok, data} ->
        json(conn, %{
          success: true,
          transactionId: data["TransactionID"],
          messageId: data["MessageID"]
        })

      error ->
        api_error(conn, error)
    end
  end

  def send_email(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "Missing required fields: to, subject, message"})
  end
end
