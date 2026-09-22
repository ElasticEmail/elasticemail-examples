# Sub-accounts let you isolate customers or projects with their own API keys and credits.
# Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
create_enabled = System.get_env("CREATE_SUBACCOUNT") == "true"

sub_email =
  System.get_env("SUBACCOUNT_EMAIL") || "sub-#{System.system_time(:millisecond)}@example.com"

sub_path = ElasticEmail.path_segment(sub_email)

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

case ElasticEmail.get("/subaccounts", limit: 20, offset: 0) do
  {:ok, subs} ->
    IO.puts("Sub-accounts (#{length(subs)}):")

    Enum.each(subs, fn s ->
      IO.puts(
        " - #{s["Email"]} status=#{s["Status"]} credits=#{s["EmailCredits"]} sent=#{s["TotalEmailsSent"]}"
      )
    end)

  error ->
    fail.("list sub-accounts", error)
end

unless create_enabled do
  IO.puts("\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.")
  System.halt(0)
end

password = "Tmp-" <> Base.encode16(:crypto.strong_rand_bytes(6), case: :lower) <> "-Aa1!"

with {:ok, s} <-
       ElasticEmail.post("/subaccounts", %{
         "Email" => sub_email,
         "Password" => password,
         "SendActivation" => false
       }),
     _ <- IO.puts("\nSub-account created: #{s["Email"]}"),
     {:ok, _} <-
       ElasticEmail.patch("/subaccounts/#{sub_path}/credits", %{
         "Credits" => 1000,
         "Notes" => "Initial allocation"
       }),
     _ <- IO.puts("Assigned 1000 credits to #{sub_email}"),
     {:ok, key} <- ElasticEmail.get("/subaccounts/#{sub_path}/apikey") do
  IO.puts("Sub-account API key retrieved (length): #{String.length(to_string(key))}")
else
  error -> fail.("create sub-account", error)
end
