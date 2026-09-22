alias ElasticEmail.Env

from = Env.from()
to = Env.to()

# Random UUID-like string (v4 layout) without an extra dependency
uuid = fn ->
  <<a::32, b::16, c::16, d::16, e::48>> = :crypto.strong_rand_bytes(16)

  :io_lib.format("~8.16.0b-~4.16.0b-~4.16.0b-~4.16.0b-~12.16.0b", [a, b, c, d, e])
  |> IO.iodata_to_binary()
end

# Gmail groups emails into threads based on subject and Message-ID/References headers.
# A unique X-Entity-Ref-ID header per email prevents this grouping.
for i <- 1..3 do
  case ElasticEmail.send_transactional(%{
         "Recipients" => %{"To" => [to]},
         "Content" => %{
           "From" => from,
           # Same subject for all
           "Subject" => "Order Confirmation",
           "Body" => [
             %{
               "ContentType" => "HTML",
               "Content" =>
                 "<h1>Order Confirmation</h1><p>This is email ##{i}. Each appears as a separate conversation in Gmail.</p>"
             }
           ],
           "Headers" => %{"X-Entity-Ref-ID" => uuid.()}
         }
       }) do
    {:ok, data} ->
      IO.puts("Email ##{i} sent: #{data["MessageID"]}")

    error ->
      IO.puts(:stderr, "Error sending email ##{i}: #{ElasticEmail.format_error(error)}")
      System.halt(1)
  end
end

IO.puts("\nAll emails sent with unique X-Entity-Ref-ID headers.")
