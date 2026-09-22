alias ElasticEmail.Env

from = Env.from()
to = Env.to()
template_name = Env.template_name()

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

# Templates are referenced by name. Create it on first run.
case ElasticEmail.get("/templates/#{ElasticEmail.path_segment(template_name)}") do
  {:ok, _template} ->
    IO.puts(~s(Template "#{template_name}" already exists.))

  {:error, 404, _body} ->
    case ElasticEmail.post("/templates", %{
           "Name" => template_name,
           "Subject" => "Welcome, {firstname}!",
           "Body" => [
             %{
               "ContentType" => "HTML",
               "Content" => "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>"
             }
           ],
           "TemplateScope" => "Personal"
         }) do
      {:ok, _} -> IO.puts(~s(Template "#{template_name}" created.))
      error -> fail.("create template", error)
    end

  error ->
    fail.("get template", error)
end

# Merge values replace {placeholders} in the template subject and body.
case ElasticEmail.send_transactional(%{
       "Recipients" => %{"To" => [to]},
       "Content" => %{
         "From" => from,
         "TemplateName" => template_name,
         "Merge" => %{"firstname" => "Ann", "company" => "Acme"}
       }
     }) do
  {:ok, data} ->
    IO.puts("Template email sent successfully!")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Message ID: #{data["MessageID"]}")

  error ->
    fail.("send", error)
end
