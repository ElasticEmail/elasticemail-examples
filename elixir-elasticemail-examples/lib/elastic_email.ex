defmodule ElasticEmail do
  @moduledoc """
  Minimal client for the Elastic Email REST API v4 built on Req.

  There is no official Elixir SDK. Every function here maps to one HTTP call.
  JSON bodies use the PascalCase keys from the API reference.

  Results are `{:ok, body}` for 2xx responses and `{:error, status, body}`
  otherwise. API errors have the shape `%{"Error" => "message"}`.
  A transport failure is reported as `{:error, 0, reason}`.
  """

  @base_url "https://api.elasticemail.com/v4"

  @doc "Build a Req request with the base URL and the API key header."
  def new do
    Req.new(
      base_url: @base_url,
      headers: [{"X-ElasticEmail-ApiKey", ElasticEmail.Env.api_key!()}]
    )
  end

  def get(path, params \\ []), do: request(:get, path, params: params)

  def post(path, body, params \\ []), do: request(:post, path, json: body, params: params)

  def put(path, body), do: request(:put, path, json: body)

  def patch(path, body), do: request(:patch, path, json: body)

  def delete(path), do: request(:delete, path, [])

  @doc "POST /emails/transactional. Returns `{:ok, %{\"TransactionID\" => _, \"MessageID\" => _}}`."
  def send_transactional(data), do: post("/emails/transactional", data)

  @doc "Percent-encode a value used as a path segment (emails, template names, list names)."
  def path_segment(value), do: URI.encode(to_string(value), &URI.char_unreserved?/1)

  @doc "Human readable error, e.g. `400: Invalid API key`."
  def format_error({:error, status, body}), do: format_error(status, body)

  def format_error(0, reason), do: "request failed: #{inspect(reason)}"
  def format_error(status, %{"Error" => message}), do: "#{status}: #{message}"
  def format_error(status, body) when is_binary(body) and body != "", do: "#{status}: #{body}"
  def format_error(status, body), do: "#{status}: #{inspect(body)}"

  @doc "Error message only, used by the Phoenix app for `{\"error\": ...}` responses."
  def error_message({:error, 0, reason}), do: "request failed: #{inspect(reason)}"
  def error_message({:error, _status, %{"Error" => message}}), do: message
  def error_message({:error, status, body}), do: format_error(status, body)

  defp request(method, path, opts) do
    case Req.request(new(), [method: method, url: path] ++ opts) do
      {:ok, %Req.Response{status: status, body: body}} when status in 200..299 ->
        {:ok, body}

      {:ok, %Req.Response{status: status, body: body}} ->
        {:error, status, body}

      {:error, exception} ->
        {:error, 0, Exception.message(exception)}
    end
  end
end
