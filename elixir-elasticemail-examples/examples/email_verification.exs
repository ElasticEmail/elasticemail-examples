alias ElasticEmail.Env

# Usage: mix run examples/email_verification.exs someone@example.com
email = List.first(System.argv()) || Env.to()
email_path = ElasticEmail.path_segment(email)

# Email verification is a paid feature. Accounts without it get a 4xx here.
with {:ok, _} <- ElasticEmail.post("/verifications/#{email_path}", %{}),
     {:ok, v} <- ElasticEmail.get("/verifications/#{email_path}") do
  IO.puts("=== Verification result ===")
  IO.puts("Email:       #{v["Email"]}")
  IO.puts("Result:      #{v["Result"]}")
  IO.puts("Reason:      #{v["Reason"] || ""}")
  IO.puts("Disposable:  #{v["Disposable"]}")
  IO.puts("Role:        #{v["Role"]}")
  if v["SuggestedSpelling"], do: IO.puts("Did you mean: #{v["SuggestedSpelling"]}")
else
  error ->
    IO.puts(:stderr, "Error verifying email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
