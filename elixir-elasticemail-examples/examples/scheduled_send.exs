alias ElasticEmail.Env

from = Env.from()
to = Env.to()

# TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
# Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
delay_minutes = 60

scheduled_for =
  DateTime.utc_now()
  |> DateTime.add(delay_minutes * 60, :second)
  |> DateTime.truncate(:second)
  |> DateTime.to_iso8601()

case ElasticEmail.send_transactional(%{
       "Recipients" => %{"To" => [to]},
       "Content" => %{
         "From" => from,
         "Subject" => "Scheduled Email",
         "Body" => [
           %{
             "ContentType" => "HTML",
             "Content" =>
               "<h1>Scheduled Email</h1><p>This email was scheduled for #{scheduled_for}.</p>"
           }
         ]
       },
       "Options" => %{"TimeOffset" => delay_minutes}
     }) do
  {:ok, data} ->
    IO.puts("Email scheduled for #{scheduled_for}")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Message ID: #{data["MessageID"]}")

  error ->
    IO.puts(:stderr, "Error scheduling email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
