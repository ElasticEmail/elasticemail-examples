# frozen_string_literal: true

class ApplicationController < ActionController::API
  SECRET = ENV.fetch("ELASTICEMAIL_WEBHOOK_TOKEN", "change_me")
  # Signing secret returned once when the webhook is created with EnableSigning ("" when unset)
  WEBHOOK_SECRET = ENV.fetch("ELASTICEMAIL_WEBHOOK_SECRET", "")
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

  # Verifies an Elastic Email webhook signature: lowercase hex HMAC-SHA256 of
  # "{timestamp}\n{METHOD}\n{request target}\n{raw body}" keyed with the signing secret.
  # The header may carry several comma-separated "v1=" entries; any match is accepted.
  # Requests older than 5 minutes are rejected.
  def verify_signature(secret, timestamp, signature_header, method, target, body, now: Time.now.to_i)
    return false if signature_header.to_s.empty? || !timestamp.to_s.match?(/\A\d+\z/)
    return false if (now - timestamp.to_i).abs > 300

    message = "#{timestamp}\n#{method}\n#{target}\n".b + body.to_s.b
    expected = OpenSSL::HMAC.hexdigest("SHA256", secret, message)
    signature_header.split(",").map(&:strip).any? do |entry|
      entry.start_with?("v1=") && OpenSSL.secure_compare(expected, entry.delete_prefix("v1="))
    end
  end

  # before_action for webhook routes: sets @event (lowercase keys) or answers 401.
  # With ELASTICEMAIL_WEBHOOK_SECRET set the signature is required and the event comes
  # from the JSON body (POST) or the query string (GET); otherwise ?token= is checked.
  def require_webhook_event!
    if WEBHOOK_SECRET.empty?
      return render json: { error: "Invalid token" }, status: :unauthorized unless token_ok?(params[:token])

      @event = params.to_unsafe_h.transform_keys { |k| k.to_s.downcase }
      return
    end

    body = request.raw_post.to_s
    target = request.env["REQUEST_URI"] || request.original_fullpath # raw path + query as received
    unless verify_signature(WEBHOOK_SECRET, request.headers["X-ElasticEmail-Timestamp"],
                            request.headers["X-ElasticEmail-Signature"], request.request_method, target, body)
      return render json: { error: "Invalid signature" }, status: :unauthorized
    end

    event = request.get? ? request.query_parameters : (JSON.parse(body) rescue {})
    @event = event.is_a?(Hash) ? event.to_h.transform_keys { |k| k.to_s.downcase } : {}
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
