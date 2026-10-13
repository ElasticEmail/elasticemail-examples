alias ElasticEmail.Env

from = Env.from()
to = Env.to()

message = %{
  "Recipients" => %{"To" => [to]},
  "Content" => %{
    "From" => from,
    "Subject" => "Hello from Elastic Email!",
    "Body" => [
      %{
        "ContentType" => "HTML",
        "Content" =>
          "<h1>Welcome!</h1><p>This email was sent using Elastic Email from Elixir.</p>"
      },
      %{
        "ContentType" => "PlainText",
        "Content" => "Welcome! This email was sent using Elastic Email from Elixir."
      }
    ]
  }
}

# Reuse this key only to retry this same send.
idempotency_key = ElasticEmail.new_idempotency_key()

case ElasticEmail.send_transactional(message, idempotency_key) do
  {:ok, data} ->
    IO.puts("Email sent successfully!")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Idempotency key: #{idempotency_key}")
    IO.puts("Message ID: #{data["MessageID"]}")

  error ->
    IO.puts(:stderr, "Error sending email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
