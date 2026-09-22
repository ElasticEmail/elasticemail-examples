# frozen_string_literal: true

##
# POST /double-optin/subscribe        body { email, name }
# GET  /double-optin/confirm?email=&token=
# POST /double-optin/webhook?token=...  Clicked-event based confirmation
class DoubleOptinController < ApplicationController
  before_action :require_token!, only: :webhook

  PUBLIC_URL = ENV.fetch("PUBLIC_URL", "http://localhost:3000")
  CONFIRM_REDIRECT_URL = ENV["CONFIRM_REDIRECT_URL"]

  def subscribe
    email = params[:email]
    name = params[:name].to_s

    return render json: { error: "Missing required field: email" }, status: :bad_request unless email

    confirm_url = "#{PUBLIC_URL}/double-optin/confirm?email=#{ERB::Util.url_encode(email)}&token=#{hmac(email)}"
    greeting = name.empty? ? "Welcome!" : "Welcome, #{name}!"

    # Stored as Transactional so it receives the confirmation but no campaigns yet
    ElasticEmail::ContactsApi.new.contacts_post(
      [
        ElasticEmail::ContactPayload.new(
          email: email,
          first_name: name.split(" ").first.to_s,
          status: "Transactional"
        )
      ]
    )

    result = ElasticEmail::EmailsApi.new.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [email]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: "Confirm your subscription",
          body: [
            html_part(<<~HTML)
              <div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
                <h1>#{greeting}</h1>
                <p>Please confirm your subscription to our newsletter.</p>
                <a href="#{confirm_url}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
              </div>
            HTML
          ]
        )
      )
    )

    render json: { success: true, message: "Confirmation email sent", messageId: result.message_id }
  rescue ElasticEmail::ApiError => e
    render_api_error(e)
  end

  def confirm
    email = params[:email].to_s
    token = params[:token].to_s

    if email.empty? || !ActiveSupport::SecurityUtils.secure_compare(hmac(email), token)
      return render json: { error: "Invalid confirmation link" }, status: :bad_request
    end

    ElasticEmail::ListsApi.new.lists_by_name_contacts_post(LIST_NAME, ElasticEmail::EmailsPayload.new(emails: [email]))

    return redirect_to CONFIRM_REDIRECT_URL, allow_other_host: true if CONFIRM_REDIRECT_URL.present?

    render json: { confirmed: true, email: email, list: LIST_NAME }
  rescue ElasticEmail::ApiError => e
    render_api_error(e)
  end

  # Create a webhook for Clicked events pointing here (see examples/webhooks.rb).
  def webhook
    status_value = sanitize(params[:status])
    target = params[:target].to_s
    recipient = params[:to].to_s

    unless status_value == "Clicked" && target.include?("/double-optin/confirm")
      return render json: { received: true, status: status_value, message: "Event ignored" }
    end

    ElasticEmail::ListsApi.new.lists_by_name_contacts_post(LIST_NAME, ElasticEmail::EmailsPayload.new(emails: [recipient]))

    render json: { received: true, confirmed: true, email: sanitize(recipient) }
  rescue ElasticEmail::ApiError => e
    render_api_error(e)
  end
end
