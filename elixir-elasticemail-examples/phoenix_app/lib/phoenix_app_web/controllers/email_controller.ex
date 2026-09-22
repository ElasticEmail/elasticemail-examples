defmodule PhoenixAppWeb.EmailController do
  use Phoenix.Controller, formats: [:json]
  import PhoenixAppWeb.Helpers

  def send_email(conn, %{"to" => to, "subject" => subject, "message" => message})
      when to != "" and subject != "" and message != "" do
    case ElasticEmail.send_transactional(%{
           "Recipients" => %{"To" => [to]},
           "Content" => %{
             "From" => ElasticEmail.Env.from(),
             "Subject" => subject,
             "Body" => [%{"ContentType" => "HTML", "Content" => "<p>#{message}</p>"}]
           }
         }) do
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
