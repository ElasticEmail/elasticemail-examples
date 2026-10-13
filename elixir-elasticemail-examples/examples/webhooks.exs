alias ElasticEmail.Env

public_url = Env.public_url()

# Signed webhook: Elastic Email adds X-ElasticEmail-Timestamp and X-ElasticEmail-Signature
# (HMAC-SHA256) headers and POSTs each event as JSON. The receiving handler verifies the
# signature with ELASTICEMAIL_WEBHOOK_SECRET (see ElasticEmail.Webhook), so the URL needs
# no ?token=. Signing and delivery method are chosen at creation and can't be changed later.
webhook_url = "#{public_url}/webhook"

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

# 1. Create. Elastic Email sends a test event to the URL on save, so the handler must be
#    reachable (use a tunnel such as ngrok for local development). The handler doesn't know
#    the secret yet and answers 401, which Elastic Email accepts for signed webhooks.
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
         "NotificationForError" => true,
         "EnableSigning" => true,
         "DeliveryMethod" => "PostJson"
       }) do
    {:ok, w} ->
      IO.puts("Webhook created: #{w["WebhookID"]} #{w["URL"]}")
      # Returned only in this response: store it as ELASTICEMAIL_WEBHOOK_SECRET
      IO.puts("Signing secret (shown once, store as ELASTICEMAIL_WEBHOOK_SECRET): #{w["SigningSecret"]}")
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

# 3. Rotate the signing secret. The old secret stops working immediately (no grace period).
if webhook_id do
  case ElasticEmail.post("/webhook/#{ElasticEmail.path_segment(webhook_id)}/secret/rotate") do
    {:ok, w} -> IO.puts("\nNew signing secret (store as ELASTICEMAIL_WEBHOOK_SECRET): #{w["SigningSecret"]}")
    error -> fail.("rotate webhook secret", error)
  end
end

# 4. Delete the one we created (comment out to keep it)
if webhook_id do
  case ElasticEmail.delete("/webhook/#{ElasticEmail.path_segment(webhook_id)}") do
    {:ok, _} -> IO.puts("\nWebhook deleted: #{webhook_id}")
    error -> fail.("delete webhook", error)
  end
end
