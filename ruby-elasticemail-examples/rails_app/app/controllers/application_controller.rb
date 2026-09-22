# frozen_string_literal: true

class ApplicationController < ActionController::API
  SECRET = ENV.fetch("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
  FROM = ENV.fetch("EMAIL_FROM", "Acme <hello@yourdomain.com>")
  LIST_NAME = ENV.fetch("ELASTICEMAIL_LIST_NAME", "Newsletter")

  private

  # Strip newlines from user-controlled values before logging
  def sanitize(value)
    value.to_s.delete("\r\n")
  end

  # Constant-time comparison of the shared secret carried in ?token=
  def token_ok?(token)
    ActiveSupport::SecurityUtils.secure_compare(token.to_s, SECRET)
  end

  def require_token!
    return if token_ok?(params[:token])

    render json: { error: "Invalid token" }, status: :unauthorized
  end

  def hmac(value)
    OpenSSL::HMAC.hexdigest("SHA256", SECRET, value)
  end

  def html_part(content)
    ElasticEmail::BodyPart.new(content_type: "HTML", content: content)
  end

  # Elastic Email errors carry the HTTP status in e.code and {"Error": "..."} in e.response_body
  def render_api_error(e)
    message = begin
      JSON.parse(e.response_body.to_s)["Error"]
    rescue JSON::ParserError, TypeError
      nil
    end
    render json: { error: message || e.message || "Unknown error" }, status: e.code || 500
  end
end
