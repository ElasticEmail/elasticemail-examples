# frozen_string_literal: true

##
# POST /send
#
# Request body: { to, subject, message }
# Response:     { success: true, transactionId, messageId }
class EmailsController < ApplicationController
  def send_email
    to = params[:to]
    subject = params[:subject]
    message = params[:message]

    unless to && subject && message
      return render json: { error: "Missing required fields: to, subject, message" }, status: :bad_request
    end

    result = ElasticEmail::EmailsApi.new.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [to]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: subject,
          body: [html_part("<p>#{message}</p>")]
        )
      )
    )

    render json: { success: true, transactionId: result.transaction_id, messageId: result.message_id }
  rescue ElasticEmail::ApiError => e
    render_api_error(e)
  end
end
