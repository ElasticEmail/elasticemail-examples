alias ElasticEmail.Env

public_url = Env.public_url()
token = Env.webhook_token()
domain = Env.sending_domain()

# Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
# Matching emails are parsed and POSTed as form fields to HttpAddress
# (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
# See phoenix_app/ for the receiving handler.

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

route_id =
  case ElasticEmail.post("/inboundroute", %{
         "Name" => "examples-inbound",
         "Filter" => "*@#{domain}",
         "FilterType" => "EmailAddress",
         "ActionType" => "NotifyViaHttp",
         "HttpAddress" => "#{public_url}/inbound?token=#{URI.encode_www_form(token)}"
       }) do
    {:ok, r} ->
      IO.puts("Inbound route created: #{r["PublicId"]} #{r["Filter"]} -> #{r["ActionParameter"]}")
      r["PublicId"]

    error ->
      fail.("create route", error)
  end

case ElasticEmail.get("/inboundroute") do
  {:ok, routes} ->
    IO.puts("\nInbound routes (#{length(routes)}):")

    Enum.each(routes, fn r ->
      IO.puts(
        " - [#{r["SortOrder"]}] #{r["PublicId"]} #{r["Name"]}: #{r["FilterType"]}=#{r["Filter"]} " <>
          "#{r["ActionType"]} #{r["ActionParameter"] || ""}"
      )
    end)

  error ->
    fail.("list routes", error)
end

# Delete the route we created (comment out to keep it)
if route_id do
  case ElasticEmail.delete("/inboundroute/#{ElasticEmail.path_segment(route_id)}") do
    {:ok, _} -> IO.puts("\nInbound route deleted: #{route_id}")
    error -> fail.("delete route", error)
  end
end
