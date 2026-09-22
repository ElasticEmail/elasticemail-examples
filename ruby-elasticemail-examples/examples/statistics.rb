#!/usr/bin/env ruby
# frozen_string_literal: true

##
# Statistics
#
# Account-wide sending statistics for the last 30 days.
#
# Usage: ruby examples/statistics.rb

require_relative "ee"

statistics_api = ElasticEmail::StatisticsApi.new

# The SDK documents `from`/`to` as Time, but it passes the values straight into the
# query string. Time#to_s is not the format the API expects (YYYY-MM-DDThh:mm:ss, UTC),
# so format the strings here.
iso = ->(t) { t.utc.strftime("%Y-%m-%dT%H:%M:%S") }
to_time = Time.now
from_time = to_time - 30 * 24 * 60 * 60

begin
  data = statistics_api.statistics_get(iso.call(from_time), to: iso.call(to_time))

  puts "=== Statistics #{iso.call(from_time)} to #{iso.call(to_time)} ==="
  puts "Recipients:    #{data.recipients}"
  puts "Emails total:  #{data.email_total}"
  puts "Delivered:     #{data.delivered}"
  puts "Bounced:       #{data.bounced}"
  puts "In progress:   #{data.in_progress}"
  puts "Opened:        #{data.opened}"
  puts "Clicked:       #{data.clicked}"
  puts "Unsubscribed:  #{data.unsubscribed}"
  puts "Complaints:    #{data.complaints}"
rescue ElasticEmail::ApiError => e
  api_error("fetch statistics", e)
end
