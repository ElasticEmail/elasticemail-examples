# Usage: mix run examples/email_status.exs <transactionId> [messageId]
# Both ids are returned by every send call.

{transaction_id, message_id} =
  case System.argv() do
    [tid] -> {tid, nil}
    [tid, mid | _] -> {tid, mid}
    _ ->
      IO.puts(:stderr, "Usage: mix run examples/email_status.exs <transactionId> [messageId]")
      System.halt(1)
  end

case ElasticEmail.get("/emails/#{ElasticEmail.path_segment(transaction_id)}/status",
       showFailed: true,
       showSent: true,
       showDelivered: true,
       showPending: true,
       showOpened: true,
       showClicked: true
     ) do
  {:ok, s} ->
    IO.puts("=== Transaction status ===")
    IO.puts("Status:      #{s["Status"]}")
    IO.puts("Recipients:  #{s["RecipientsCount"]}")
    IO.puts("Sent:        #{s["SentCount"]} #{inspect(s["Sent"] || [])}")
    IO.puts("Delivered:   #{s["DeliveredCount"]} #{inspect(s["Delivered"] || [])}")
    IO.puts("Pending:     #{s["PendingCount"]}")
    IO.puts("Opened:      #{s["OpenedCount"]}")
    IO.puts("Clicked:     #{s["ClickedCount"]}")
    IO.puts("Failed:      #{s["FailedCount"]} #{inspect(s["Failed"] || [])}")

  error ->
    IO.puts(:stderr, "Error fetching status: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end

if message_id do
  case ElasticEmail.get("/emails/#{ElasticEmail.path_segment(message_id)}/view") do
    {:ok, m} ->
      preview = m["Preview"] || %{}
      status = m["Status"] || %{}
      body = preview["Body"] || ""

      IO.puts("\n=== Message ===")
      IO.puts("From:     #{preview["From"]}")
      IO.puts("Subject:  #{preview["Subject"]}")
      IO.puts("Status:   #{status["StatusName"]} #{status["DateSent"] || ""}")

      body_preview =
        if String.length(body) > 200, do: String.slice(body, 0, 200) <> "...", else: body

      IO.puts("Body preview: #{body_preview}")

    error ->
      IO.puts(:stderr, "Error fetching message: #{ElasticEmail.format_error(error)}")
  end
end
