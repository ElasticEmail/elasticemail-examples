alias ElasticEmail.Env

# Usage: mix run examples/double_optin/subscribe.exs user@example.com "John Doe"
{email, name} =
  case System.argv() do
    [email] -> {email, ""}
    [email, name | _] -> {email, name}
    _ ->
      IO.puts(:stderr, ~s(Usage: mix run examples/double_optin/subscribe.exs <email> ["Name"]))
      System.halt(1)
  end

from = Env.from()
public_url = Env.public_url()
secret = Env.webhook_token()

# The confirm link carries an HMAC of the email so the confirm endpoint can trust it.
confirm_token = :crypto.mac(:hmac, :sha256, secret, email) |> Base.encode16(case: :lower)

confirm_url =
  "#{public_url}/double-optin/confirm?email=#{URI.encode_www_form(email)}&token=#{confirm_token}"

fail = fn error ->
  IO.puts(:stderr, "Error: #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

[first_name | rest] = String.split(name, " ")
last_name = Enum.join(rest, " ")

# Step 1: store the contact without adding it to the marketing list.
# Status "Transactional" allows sending the confirmation but excludes it from campaigns.
case ElasticEmail.post("/contacts", [
       %{
         "Email" => email,
         "FirstName" => first_name,
         "LastName" => last_name,
         "Status" => "Transactional"
       }
     ]) do
  {:ok, _} -> IO.puts("Contact stored (unconfirmed): #{email}")
  error -> fail.(error)
end

# Step 2: send the confirmation email
greeting = if name == "", do: "Welcome!", else: "Welcome, #{name}!"

html = """
<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>#{greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="#{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>
"""

case ElasticEmail.send_transactional(%{
       "Recipients" => %{"To" => [email]},
       "Content" => %{
         "From" => from,
         "Subject" => "Confirm your subscription",
         "Body" => [
           %{"ContentType" => "HTML", "Content" => html},
           %{
             "ContentType" => "PlainText",
             "Content" => "#{greeting}\n\nConfirm your subscription: #{confirm_url}"
           }
         ]
       }
     }) do
  {:ok, data} ->
    IO.puts("Confirmation email sent. Message ID: #{data["MessageID"]}")
    IO.puts("Confirm URL: #{confirm_url}")

    IO.puts(
      "\nWhen the link is opened, GET /double-optin/confirm in phoenix_app adds the contact to the list."
    )

  error ->
    fail.(error)
end
