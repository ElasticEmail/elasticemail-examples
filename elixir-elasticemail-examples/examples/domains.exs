alias ElasticEmail.Env

domain = Env.sending_domain()
domain_path = ElasticEmail.path_segment(domain)

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

flag = fn value -> if value, do: "ok", else: "missing" end

# 1. Add the domain
case ElasticEmail.post("/domains", %{"Domain" => domain}) do
  {:ok, _} ->
    IO.puts(~s(Domain "#{domain}" added.))

  {:error, 400, body} = error ->
    if inspect(body) =~ ~r/exist|already/i,
      do: IO.puts(~s(Domain "#{domain}" already exists.)),
      else: fail.("add domain", error)

  error ->
    fail.("add domain", error)
end

# 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
case ElasticEmail.get("/domains/#{domain_path}") do
  {:ok, d} ->
    IO.puts("\nVerification status:")
    IO.puts("  SPF:       #{flag.(d["Spf"])}")
    IO.puts("  DKIM:      #{flag.(d["Dkim"])}")
    IO.puts("  MX:        #{flag.(d["MX"])}")
    IO.puts("  DMARC:     #{flag.(d["DMARC"])}")
    IO.puts("  Tracking:  #{d["TrackingStatus"] || "n/a"}")
    IO.puts("  Default:   #{if d["DefaultDomain"], do: "yes", else: "no"}")

    if d["DKIMRecord"] do
      IO.puts("\nDKIM record to publish: #{Jason.encode!(d["DKIMRecord"])}")
    end

  error ->
    fail.("get domain", error)
end

# 3. List all domains
case ElasticEmail.get("/domains") do
  {:ok, domains} ->
    IO.puts("\nDomains on the account (#{length(domains)}):")

    Enum.each(domains, fn d ->
      IO.puts(" - #{d["Domain"]} spf=#{d["Spf"]} dkim=#{d["Dkim"]} default=#{d["DefaultDomain"]}")
    end)

  error ->
    fail.("list domains", error)
end

# 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
# ElasticEmail.put("/domains/#{domain_path}/verification", "Http")

# 5. Optional: set the default sender for the account
# ElasticEmail.patch("/domains/#{ElasticEmail.path_segment("hello@" <> domain)}/default", %{})

IO.puts("\nDone.")
