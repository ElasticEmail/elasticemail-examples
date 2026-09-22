alias ElasticEmail.Env

public_url = Env.public_url()
token = Env.webhook_token()

# Elastic Email does not sign webhook requests. The examples append a shared secret
# as a query parameter and the receiving handler checks it.
webhook_url = "#{public_url}/webhook?token=#{URI.encode_www_form(token)}"

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

# 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
#    and answer 2xx (use a tunnel such as ngrok for local development).
webhook_id =
  case ElasticEmail.post("/webhook", %{
         "Name" => "examples-webhook",
         "URL" => webhook_url,
         "NotifyOncePerEmail" => false,
         "NotificationForSent" => true,
         "NotificationForOpened" => true,
         "NotificationForClicked" => true,
         "NotificationForUnsubscribed" => true,
         "NotificationForAbuseReport" => true,
         "NotificationForError" => true
       }) do
    {:ok, w} ->
      IO.puts("Webhook created: #{w["WebhookID"]} #{w["URL"]}")
      w["WebhookID"]

    error ->
      fail.("create webhook", error)
  end

# 2. List
case ElasticEmail.get("/webhook", limit: 50, offset: 0) do
  {:ok, webhooks} ->
    IO.puts("\nWebhooks (#{length(webhooks)}):")

    Enum.each(webhooks, fn w ->
      IO.puts(" - #{w["WebhookID"]} #{w["Name"]} #{w["URL"]} enabled=#{w["IsEnabled"]}")
    end)

  error ->
    fail.("list webhooks", error)
end

# 3. Delete the one we created (comment out to keep it)
if webhook_id do
  case ElasticEmail.delete("/webhook/#{ElasticEmail.path_segment(webhook_id)}") do
    {:ok, _} -> IO.puts("\nWebhook deleted: #{webhook_id}")
    error -> fail.("delete webhook", error)
  end
end
