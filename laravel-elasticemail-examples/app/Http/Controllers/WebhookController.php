<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Elastic Email event notifications.
 *
 * Elastic Email does not sign webhooks. The webhook URL carries a shared secret as
 * ?token=..., checked against ELASTICEMAIL_WEBHOOK_TOKEN with a constant-time compare.
 * Parameters arrive in the query string (GET) or as form fields (POST): transaction,
 * messageid, to, from, subject, date, status (Sent, Opened, Clicked, Error, AbuseReport,
 * Unsubscribed), category, channel, target (clicked URL), IP, Useragent, Country, City.
 * Elastic Email sends a GET to validate the URL when the webhook is saved.
 */
class WebhookController extends Controller
{
    public function handle(Request $request)
    {
        if (!$this->ee->tokenOk($request->query('token'))) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        $event = array_merge($request->query(), $request->post());
        $status = $this->sanitize($event['status'] ?? '');

        if ($status === '') {
            // Validation ping or empty request
            return response()->json(['ok' => true]);
        }

        Log::info("Webhook event: {$status}", [
            'to' => $this->sanitize($event['to'] ?? ''),
            'transaction' => $this->sanitize($event['transaction'] ?? ''),
            'messageid' => $this->sanitize($event['messageid'] ?? ''),
        ]);

        switch ($status) {
            case 'Sent':
                Log::info('Email sent', ['messageid' => $this->sanitize($event['messageid'] ?? '')]);
                break;
            case 'Opened':
                Log::info('Email opened', ['country' => $this->sanitize($event['Country'] ?? ''), 'city' => $this->sanitize($event['City'] ?? '')]);
                break;
            case 'Clicked':
                Log::info('Link clicked', ['target' => $this->sanitize($event['target'] ?? '')]);
                break;
            case 'Error':
                Log::warning('Bounce/error', ['category' => $this->sanitize($event['category'] ?? '')]);
                break;
            case 'AbuseReport':
                Log::warning('Complaint received');
                break;
            case 'Unsubscribed':
                Log::info('Recipient unsubscribed');
                break;
        }

        return response()->json(['received' => true, 'status' => $status]);
    }
}
