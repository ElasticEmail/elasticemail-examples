alias ElasticEmail.Env

from = Env.from()
to = Env.to()

case ElasticEmail.send_transactional(%{
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
     }) do
  {:ok, data} ->
    IO.puts("Email sent successfully!")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Message ID: #{data["MessageID"]}")

  error ->
    IO.puts(:stderr, "Error sending email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
