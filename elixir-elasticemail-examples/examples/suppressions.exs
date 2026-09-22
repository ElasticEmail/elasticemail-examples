# Usage: mix run examples/suppressions.exs [email]
email = List.first(System.argv()) || "suppressed@example.com"
email_path = ElasticEmail.path_segment(email)

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

# Suppressions are split into unsubscribes, bounces and complaints.
# Adding to any list stops future sends to that address. The body is a JSON array.
case ElasticEmail.post("/suppressions/unsubscribes", [email]) do
  {:ok, _} -> IO.puts("Added to unsubscribes: #{email}")
  error -> fail.("add unsubscribe", error)
end

case ElasticEmail.get("/suppressions/#{email_path}") do
  {:ok, s} ->
    IO.puts(
      "Suppression: " <>
        inspect(%{
          Email: s["Email"],
          Reason: s["FriendlyErrorMessage"],
          DateUpdated: s["DateUpdated"]
        })
    )

  error ->
    fail.("get suppression", error)
end

case ElasticEmail.get("/suppressions", limit: 10, offset: 0) do
  {:ok, suppressions} ->
    IO.puts("\nAll suppressions (first #{length(suppressions)}):")
    Enum.each(suppressions, fn s -> IO.puts(" - #{s["Email"]} #{s["FriendlyErrorMessage"] || ""}") end)

  error ->
    fail.("list suppressions", error)
end

# Remove it again so the address can receive email
case ElasticEmail.delete("/suppressions/#{email_path}") do
  {:ok, _} -> IO.puts("\nRemoved from suppressions: #{email}")
  error -> fail.("delete suppression", error)
end
