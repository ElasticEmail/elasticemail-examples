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

    # Forward the client's Idempotency-Key so its retries can't send twice; otherwise use a new one.
    idempotency_key = request.headers["Idempotency-Key"].presence || SecureRandom.uuid

    result = ElasticEmail::EmailsApi.new.emails_transactional_post(
      ElasticEmail::EmailTransactionalMessageData.new(
        recipients: ElasticEmail::TransactionalRecipient.new(to: [to]),
        content: ElasticEmail::EmailContent.new(
          from: FROM,
          subject: subject,
          body: [html_part("<p>#{message}</p>")]
        )
      ),
      idempotency_key: idempotency_key
    )

    render json: { success: true, transactionId: result.transaction_id, messageId: result.message_id }
  rescue ElasticEmail::ApiError => e
    render_api_error(e)
  end
end
