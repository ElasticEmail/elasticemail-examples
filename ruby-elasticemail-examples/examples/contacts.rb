#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Contacts and Lists Management
#
# Elastic Email lists are addressed by name, not by id.
#
# Usage: ruby examples/contacts.rb

require_relative "ee"

contacts_api = ElasticEmail::ContactsApi.new
lists_api = ElasticEmail::ListsApi.new

email = TO

# 1. Create a list
begin
  lists_api.lists_post(ElasticEmail::ListPayload.new(list_name: LIST_NAME, allow_unsubscribe: true))
  puts "List \"#{LIST_NAME}\" created."
rescue ElasticEmail::ApiError => e
  if already_exists?(e)
    puts "List \"#{LIST_NAME}\" already exists."
  else
    api_error("create list", e)
  end
end

# 2. Add a contact and put it on the list in one call
begin
  contacts = contacts_api.contacts_post(
    [
      ElasticEmail::ContactPayload.new(
        email: email,
        first_name: "Ann",
        last_name: "Example",
        status: "Active",
        custom_fields: { "plan" => "Pro" } # only existing custom fields are saved
      )
    ],
    listnames: [LIST_NAME]
  )
  puts "Contact added: #{contacts.first&.email} status: #{contacts.first&.status}"
rescue ElasticEmail::ApiError => e
  api_error("add contact", e)
end

# 3. Read it back
begin
  contact = contacts_api.contacts_by_email_get(email)
  puts "Contact: email=#{contact.email} first_name=#{contact.first_name} status=#{contact.status} source=#{contact.source}"
rescue ElasticEmail::ApiError => e
  api_error("get contact", e)
end

# 4. Update
begin
  contact = contacts_api.contacts_by_email_put(email, ElasticEmail::ContactUpdatePayload.new(first_name: "Anna"))
  puts "Contact updated. FirstName: #{contact.first_name}"
rescue ElasticEmail::ApiError => e
  api_error("update contact", e)
end

# 5. List contacts on the list
begin
  contacts = lists_api.lists_by_listname_contacts_get(LIST_NAME, limit: 10, offset: 0)
  puts "Contacts in \"#{LIST_NAME}\" (first #{contacts.length}):"
  contacts.each { |c| puts " - #{c.email} #{c.status}" }
rescue ElasticEmail::ApiError => e
  api_error("list contacts", e)
end

# 6. Delete the contact (uncomment to clean up)
# contacts_api.contacts_by_email_delete(email)
# puts "Contact deleted."

puts "\nDone."
