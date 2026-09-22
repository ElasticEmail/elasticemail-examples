defmodule PhoenixApp.MixProject do
  use Mix.Project

  def project do
    [
      app: :phoenix_app,
      version: "0.1.0",
      elixir: "~> 1.15",
      start_permanent: Mix.env() == :prod,
      deps: deps()
    ]
  end

  def application do
    [
      extra_applications: [:logger, :crypto],
      mod: {PhoenixApp.Application, []}
    ]
  end

  defp deps do
    [
      {:phoenix, "~> 1.7"},
      {:bandit, "~> 1.5"},
      {:jason, "~> 1.4"},
      {:req, "~> 0.5"},
      # ElasticEmail client and ElasticEmail.Env from the parent folder
      {:elasticemail_examples, path: ".."}
    ]
  end
end
