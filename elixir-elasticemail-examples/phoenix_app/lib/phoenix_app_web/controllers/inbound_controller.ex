defmodule PhoenixAppWeb.InboundController do
  use Phoenix.Controller, formats: [:json]
  import PhoenixAppWeb.Helpers
  require Logger

  # Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
  # Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
  # subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
  def create(conn, params) do
    if token_ok?(params["token"]) do
      forward(conn, params)
    else
      unauthorized(conn)
    end
  end

  defp forward(conn, mail) do
    attachments =
      mail
      |> Map.keys()
      |> Enum.filter(&Regex.match?(~r/^att\d+_name$/, &1))
      |> Enum.map(fn key ->
        %{name: mail[key], content: mail[String.replace(key, "_name", "_content")]}
      end)

    Logger.info(
      "Inbound email from: #{sanitize(mail["from_email"])} subject: #{sanitize(mail["subject"])}"
    )

    names = attachments |> Enum.map(& &1.name) |> Enum.join(", ")
    Logger.info("Attachments: #{if names == "", do: "none", else: names}")

    body_html =
      case mail["body_html"] do
        html when is_binary(html) and html != "" -> html
        _ -> "<pre>#{String.replace(mail["body_text"] || "", "<", "&lt;")}</pre>"
      end

    # Forward a copy to the team inbox
    case ElasticEmail.send_transactional(%{
           "Recipients" => %{"To" => [ElasticEmail.Env.contact_email()]},
           "Content" => %{
             "From" => ElasticEmail.Env.from(),
             "ReplyTo" => mail["from_email"],
             "Subject" => "Fwd: #{mail["subject"] || "(no subject)"}",
             "Body" => [%{"ContentType" => "HTML", "Content" => body_html}],
             "Attachments" =>
               attachments
               |> Enum.filter(&(&1.content not in [nil, ""]))
               |> Enum.map(&%{"Name" => &1.name, "BinaryContent" => &1.content})
           }
         }) do
      {:ok, data} -> json(conn, %{received: true, forwardedMessageId: data["MessageID"]})
      error -> api_error(conn, error)
    end
  end
end
