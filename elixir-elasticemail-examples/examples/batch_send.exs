alias ElasticEmail.Env

from = Env.from()
to = Env.to()

# Bulk send: one API call, one personalized email per recipient.
# Values from Recipients[].Fields replace {placeholders} in the body.
# Up to 1000 recipients per request.
recipients = [
  %{"Email" => to, "Fields" => %{"firstname" => "Ann", "plan" => "Pro"}},
  %{"Email" => to, "Fields" => %{"firstname" => "Ben", "plan" => "Starter"}},
  %{"Email" => to, "Fields" => %{"firstname" => "Cleo", "plan" => "Team"}}
]

case ElasticEmail.post("/emails", %{
       "Recipients" => recipients,
       "Content" => %{
         "From" => from,
         "Subject" => "Hi {firstname}, your {plan} plan is ready",
         "Body" => [
           %{
             "ContentType" => "HTML",
             "Content" =>
               "<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>"
           },
           %{
             "ContentType" => "PlainText",
             "Content" => "Hi {firstname}! Your {plan} plan is now active."
           }
         ]
       }
     }) do
  {:ok, data} ->
    IO.puts("Bulk email queued for #{length(recipients)} recipients.")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Check delivery with: mix run examples/email_status.exs #{data["TransactionID"]}")

  error ->
    IO.puts(:stderr, "Error sending bulk email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
