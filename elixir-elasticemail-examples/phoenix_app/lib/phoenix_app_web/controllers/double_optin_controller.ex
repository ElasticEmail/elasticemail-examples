defmodule PhoenixAppWeb.DoubleOptinController do
  use Phoenix.Controller, formats: [:json]
  import PhoenixAppWeb.Helpers
  alias ElasticEmail.Env

  def subscribe(conn, %{"email" => email} = params) when is_binary(email) and email != "" do
    name = to_string(params["name"] || "")
    first_name = name |> String.split(" ") |> List.first()

    confirm_url =
      "#{Env.public_url()}/double-optin/confirm?email=#{URI.encode_www_form(email)}&token=#{hmac(email)}"

    greeting = if name == "", do: "Welcome!", else: "Welcome, #{name}!"

    html = """
    <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
      <h1>#{greeting}</h1>
      <p>Please confirm your subscription to our newsletter.</p>
      <a href="#{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
    </div>
    """

    # Stored as Transactional so it receives the confirmation but no campaigns yet
    with {:ok, _} <-
           ElasticEmail.post("/contacts", [
             %{"Email" => email, "FirstName" => first_name, "Status" => "Transactional"}
           ]),
         {:ok, data} <-
           ElasticEmail.send_transactional(%{
             "Recipients" => %{"To" => [email]},
             "Content" => %{
               "From" => Env.from(),
               "Subject" => "Confirm your subscription",
               "Body" => [%{"ContentType" => "HTML", "Content" => html}]
             }
           }) do
      json(conn, %{success: true, message: "Confirmation email sent", messageId: data["MessageID"]})
    else
      error -> api_error(conn, error)
    end
  end

  def subscribe(conn, _params) do
    conn
    |> put_status(400)
    |> json(%{error: "Missing required field: email"})
  end

  def confirm(conn, params) do
    email = to_string(params["email"] || "")
    token = to_string(params["token"] || "")

    if email == "" or not Plug.Crypto.secure_compare(hmac(email), token) do
      conn
      |> put_status(400)
      |> json(%{error: "Invalid confirmation link"})
    else
      list_name = Env.list_name()

      case add_to_list(list_name, email) do
        {:ok, _} ->
          case Env.confirm_redirect_url() do
            nil -> json(conn, %{confirmed: true, email: email, list: list_name})
            url -> redirect(conn, external: url)
          end

        error ->
          api_error(conn, error)
      end
    end
  end

  # Click-tracking based confirmation: create a webhook for Clicked events pointing here.
  def webhook(conn, params) do
    if token_ok?(params["token"]) do
      confirm_from_click(conn, params)
    else
      unauthorized(conn)
    end
  end

  defp confirm_from_click(conn, event) do
    status = sanitize(event["status"])
    target = sanitize(event["target"])
    recipient = sanitize(event["to"])

    if status != "Clicked" or not String.contains?(target, "/double-optin/confirm") do
      json(conn, %{received: true, status: status, message: "Event ignored"})
    else
      case add_to_list(Env.list_name(), recipient) do
        {:ok, _} -> json(conn, %{received: true, confirmed: true, email: recipient})
        error -> api_error(conn, error)
      end
    end
  end

  defp add_to_list(list_name, email) do
    ElasticEmail.post("/lists/#{ElasticEmail.path_segment(list_name)}/contacts", %{
      "Emails" => [email]
    })
  end
end
