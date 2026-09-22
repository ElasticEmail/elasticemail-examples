#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Using Templates Example
#
# Templates are referenced by name. The template is created on first run,
# then a transactional email is sent with merge values.
#
# Usage: ruby examples/with_template.rb

require_relative "ee"

emails_api = ElasticEmail::EmailsApi.new
templates_api = ElasticEmail::TemplatesApi.new

def ensure_template(templates_api)
  templates_api.templates_by_name_get(TEMPLATE_NAME)
  puts "Template \"#{TEMPLATE_NAME}\" already exists."
rescue ElasticEmail::ApiError => e
  raise e unless e.code == 404

  templates_api.templates_post(
    ElasticEmail::TemplatePayload.new(
      name: TEMPLATE_NAME,
      subject: "Welcome, {firstname}!",
      body: [
        ElasticEmail::BodyPart.new(
          content_type: "HTML",
          content: "<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>"
        )
      ],
      template_scope: "Personal"
    )
  )
  puts "Template \"#{TEMPLATE_NAME}\" created."
end

begin
  ensure_template(templates_api)

  # Merge values replace {placeholders} in the template subject and body.
  result = emails_api.emails_transactional_post(
    ElasticEmail::EmailTransactionalMessageData.new(
      recipients: ElasticEmail::TransactionalRecipient.new(to: [TO]),
      content: ElasticEmail::EmailContent.new(
        from: FROM,
        template_name: TEMPLATE_NAME,
        merge: { "firstname" => "Ann", "company" => "Acme" }
      )
    )
  )

  puts "Template email sent successfully!"
  puts "Transaction ID: #{result.transaction_id}"
  puts "Message ID: #{result.message_id}"
rescue ElasticEmail::ApiError => e
  api_error("template send", e)
end
