# Account-wide sending statistics for the last 30 days.
# Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
iso = fn dt -> dt |> DateTime.truncate(:second) |> DateTime.to_iso8601() |> String.slice(0, 19) end

to = DateTime.utc_now()
from = DateTime.add(to, -30 * 24 * 60 * 60, :second)

case ElasticEmail.get("/statistics", from: iso.(from), to: iso.(to)) do
  {:ok, s} ->
    IO.puts("=== Statistics #{iso.(from)} to #{iso.(to)} ===")
    IO.puts("Recipients:    #{s["Recipients"]}")
    IO.puts("Emails total:  #{s["EmailTotal"]}")
    IO.puts("Delivered:     #{s["Delivered"]}")
    IO.puts("Bounced:       #{s["Bounced"]}")
    IO.puts("In progress:   #{s["InProgress"]}")
    IO.puts("Opened:        #{s["Opened"]}")
    IO.puts("Clicked:       #{s["Clicked"]}")
    IO.puts("Unsubscribed:  #{s["Unsubscribed"]}")
    IO.puts("Complaints:    #{s["Complaints"]}")

  error ->
    IO.puts(:stderr, "Error fetching statistics: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
