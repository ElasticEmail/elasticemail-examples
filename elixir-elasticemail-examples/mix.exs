defmodule ElasticEmailExamples.MixProject do
  use Mix.Project

  def project do
    [
      app: :elasticemail_examples,
      version: "0.1.0",
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto]
    ]
  end

  defp deps do
    [
      {:req, "~> 0.5"},
      {:jason, "~> 1.4"},
      # Used only by examples/double_optin/webhook.exs (mini HTTP server)
      {:plug, "~> 1.16"},
      {:bandit, "~> 1.5"}
    ]
  end
end
