alias ElasticEmail.Env

from = Env.from()
to = Env.to()

file_content = """
Sample Attachment
==================

This file was attached to your email.
Sent at: #{DateTime.utc_now() |> DateTime.to_iso8601()}
"""

encoded = Base.encode64(file_content)

case ElasticEmail.send_transactional(%{
       "Recipients" => %{"To" => [to]},
       "Content" => %{
         "From" => from,
         "Subject" => "Email with Attachment",
         "Body" => [
           %{
             "ContentType" => "HTML",
             "Content" =>
               "<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>"
           }
         ],
         # BinaryContent is base64. Total message size limit applies (see account limits).
         "Attachments" => [
           %{
             "BinaryContent" => encoded,
             "Name" => "sample.txt",
             "ContentType" => "text/plain"
           }
         ]
       }
     }) do
  {:ok, data} ->
    IO.puts("Email with attachment sent successfully!")
    IO.puts("Transaction ID: #{data["TransactionID"]}")
    IO.puts("Message ID: #{data["MessageID"]}")

  error ->
    IO.puts(:stderr, "Error sending email: #{ElasticEmail.format_error(error)}")
    System.halt(1)
end
