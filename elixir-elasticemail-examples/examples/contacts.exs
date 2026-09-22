alias ElasticEmail.Env

list_name = Env.list_name()
email = Env.to()
email_path = ElasticEmail.path_segment(email)
list_path = ElasticEmail.path_segment(list_name)

fail = fn step, error ->
  IO.puts(:stderr, "Error (#{step}): #{ElasticEmail.format_error(error)}")
  System.halt(1)
end

# 1. Create a list (Elastic Email lists are addressed by name, not by id)
case ElasticEmail.post("/lists", %{"ListName" => list_name, "AllowUnsubscribe" => true}) do
  {:ok, _} ->
    IO.puts(~s(List "#{list_name}" created.))

  {:error, 400, body} = error ->
    if inspect(body) =~ ~r/exist/i,
      do: IO.puts(~s(List "#{list_name}" already exists.)),
      else: fail.("create list", error)

  error ->
    fail.("create list", error)
end

# 2. Add a contact and put it on the list in one call.
#    The body is a JSON array; target lists go in the "listnames" query parameter.
case ElasticEmail.post(
       "/contacts",
       [
         %{
           "Email" => email,
           "FirstName" => "Ann",
           "LastName" => "Example",
           "Status" => "Active",
           # only existing custom fields are saved
           "CustomFields" => %{"plan" => "Pro"}
         }
       ],
       listnames: list_name
     ) do
  {:ok, [contact | _]} ->
    IO.puts("Contact added: #{contact["Email"]} status: #{contact["Status"]}")

  {:ok, _} ->
    IO.puts("Contact added: #{email}")

  error ->
    fail.("add contact", error)
end

# 3. Read it back
case ElasticEmail.get("/contacts/#{email_path}") do
  {:ok, c} ->
    IO.puts(
      "Contact: " <>
        inspect(%{
          Email: c["Email"],
          FirstName: c["FirstName"],
          Status: c["Status"],
          Source: c["Source"]
        })
    )

  error ->
    fail.("get contact", error)
end

# 4. Update
case ElasticEmail.put("/contacts/#{email_path}", %{"FirstName" => "Anna"}) do
  {:ok, c} -> IO.puts("Contact updated. FirstName: #{c["FirstName"]}")
  error -> fail.("update contact", error)
end

# 5. List contacts on the list
case ElasticEmail.get("/lists/#{list_path}/contacts", limit: 10, offset: 0) do
  {:ok, contacts} ->
    IO.puts(~s(Contacts in "#{list_name}" \(first #{length(contacts)}\):))
    Enum.each(contacts, fn c -> IO.puts(" - #{c["Email"]} #{c["Status"]}") end)

  error ->
    fail.("list contacts", error)
end

# 6. Delete the contact (uncomment to clean up)
# {:ok, _} = ElasticEmail.delete("/contacts/#{email_path}")
# IO.puts("Contact deleted.")

IO.puts("\nDone.")
