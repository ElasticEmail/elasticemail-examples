# frozen_string_literal: true

##
# GET|POST /webhook?token=...  Elastic Email event notifications
# POST     /inbound?token=...  Inbound email pushed by an inbound route
#
# Elastic Email does not sign these requests. The shared secret in ?token=
# is compared in constant time instead.
class WebhooksController < ApplicationController
  before_action :require_token!

  CONTACT_EMAIL = ENV.fetch("CONTACT_EMAIL", FROM)

  # Parameters arrive in the query string (GET) or as form fields (POST):
  # transaction, messageid, to, from, subject, date, status, category, channel,
  # target (clicked URL), IP, Useragent, Country, City.
  # Elastic Email sends a GET to validate the URL when the webhook is saved.
  def event
    status_value = sanitize(params[:status])

    # Validation ping or empty request
    return render json: { ok: true } if status_value.empty?

    Rails.logger.info "Webhook event: #{status_value} to: #{sanitize(params[:to])} transaction: #{sanitize(params[:transaction])}"

    case status_value
    when "Sent"
      Rails.logger.info "Email sent, message id: #{sanitize(params[:messageid])}"
    when "Opened"
      Rails.logger.info "Email opened from #{sanitize(params[:Country])} #{sanitize(params[:City])}"
    when "Clicked"
      Rails.logger.info "Link clicked: #{sanitize(params[:target])}"
    when "Error"
      Rails.logger.info "Bounce/error, category: #{sanitize(params[:category])}"
    when "AbuseReport"
      Rails.logger.info "Complaint received"
    when "Unsubscribed"
      Rails.logger.info "Recipient unsubscribed"
    end

    render json: { received: true, status: status_value }
  end

  # Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
  # subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
  def inbound
    mail = params.to_unsafe_h
    attachments = mail.keys
                      .select { |k| k.to_s.match?(/\Aatt\d+_name\z/) }
                      .map { |k| { name: mail[k], content: mail[k.to_s.sub("_name", "_content")] } }

    Rails.logger.info "Inbound email from: #{sanitize(mail['from_email'])} subject: #{sanitize(mail['subject'])}"
    names = attachments.map { |a| a[:name] }.join(", ")
    Rails.logger.info "Attachments: #{names.empty? ? 'none' : names}"

    html = mail["body_html"]
    html = "<pre>#{ERB::Util.html_escape(mail['body_text'].to_s)}</pre>" if html.blank?

    # Forward a copy to the team inbox
    result = ElasticEmail::EmailsApi.new.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [CONTACT_EMAIL]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          reply_to: mail["from_email"],
          subject: "Fwd: #{mail['subject'] || '(no subject)'}",
          body: [html_part(html)],
          attachments: attachments
            .reject { |a| a[:content].blank? }
            .map { |a| ElasticEmail::MessageAttachment.new(name: a[:name], binary_content: a[:content]) }
        )
      )
    )

    render json: { received: true, forwardedMessageId: result.message_id }
  rescue ElasticEmail::ApiError => e
    render_api_error(e)
  end
end
