# frozen_string_literal: true

##
# GET /health
class HealthController < ApplicationController
  def show
    render json: { status: "ok" }
  end
end
