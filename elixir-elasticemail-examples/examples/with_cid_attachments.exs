alias ElasticEmail.Env

from = Env.from()
to = Env.to()

# Minimal 1x1 PNG placeholder (base64-encoded)
placeholder_image =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

# Elastic Email derives the Content-ID of an attachment from its file name.
# Reference the attachment Name after "cid:" to embed it inline.
html = """
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
  <h1>Welcome!</h1>
  <p>This email contains an inline image referenced by Content-ID.</p>
</div>
"""

case ElasticEmail.send_transactional(%{
       "Recipients" => %{"To" => [to]},
       "Content" => %{
         "From" => from,
         "Subject" => "Email with Inline Image",
         "Body" => [%{"ContentType" => "HTML", "Content" => html}],
         "Attachments" => [
           %{
             "BinaryContent" => placeholder_image,
             "Name" => "logo.png",
             "ContentType" => "image/png"
           }
         ]
       }
     }) do
  {:ok, data} ->
    IO.puts("Email with inline image sent successfully!")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Message ID: #{data["MessageID"]}")

  error ->
    IO.puts(:stderr, "Error sending email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
