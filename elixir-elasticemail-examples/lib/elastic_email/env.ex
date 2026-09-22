defmodule ElasticEmail.Env do
  @moduledoc """
  Configuration values used by the examples.

  Reads the `:elasticemail_examples` application env first (set in
  config/runtime.exs from .env and the system environment) and falls back
  to `System.get_env/1`, so the module also works when used as a dependency.
  """

  @app :elasticemail_examples

  def api_key! do
    fetch(:api_key, "ELASTICEMAIL_API_KEY") ||
      raise "ELASTICEMAIL_API_KEY environment variable is required"
  end

  def from, do: fetch(:from, "EMAIL_FROM") || "Acme <hello@yourdomain.com>"
  def to, do: fetch(:to, "EMAIL_TO") || "you@yourdomain.com"
  def contact_email, do: fetch(:contact_email, "CONTACT_EMAIL") || from()
  def webhook_token, do: fetch(:webhook_token, "ELASTICEMAIL_WEBHOOK_TOKEN") || "change_me"
  def list_name, do: fetch(:list_name, "ELASTICEMAIL_LIST_NAME") || "Newsletter"
  def template_name, do: fetch(:template_name, "ELASTICEMAIL_TEMPLATE_NAME") || "welcome-example"
  def public_url, do: fetch(:public_url, "PUBLIC_URL") || "http://localhost:3000"
  def sending_domain, do: fetch(:sending_domain, "SENDING_DOMAIN") || "yourdomain.com"
  def confirm_redirect_url, do: fetch(:confirm_redirect_url, "CONFIRM_REDIRECT_URL")

  def port(default \\ 3000) do
    case fetch(:port, "PORT") do
      nil -> default
      value -> String.to_integer(value)
    end
  end

  defp fetch(key, var) do
    case Application.get_env(@app, key) || System.get_env(var) do
      nil -> nil
      "" -> nil
      value -> value
    end
  end
end
