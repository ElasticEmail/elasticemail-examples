<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Elastic Email event notifications.
 *
 * Signed webhooks (recommended): create the webhook with EnableSigning and DeliveryMethod
 * PostJson and set ELASTICEMAIL_WEBHOOK_SECRET to the SigningSecret it returns. Every request
 * must then carry a valid HMAC-SHA256 X-ElasticEmail-Signature, otherwise it gets 401 (Elastic
 * Email retries). Unsigned webhooks: leave the secret empty; the URL carries ?token=..., checked
 * against ELASTICEMAIL_WEBHOOK_TOKEN with a constant-time compare.
 * Fields: transaction, messageid, to, from, subject, date, status (Sent, Opened, Clicked, Error,
 * AbuseReport, Unsubscribed), category, channel, target (clicked URL), ip, useragent, country,
 * city - a JSON body for PostJson webhooks, the query string for Get webhooks.
 * Elastic Email sends a test request when the webhook is saved.
 */
class WebhookController extends Controller
{
    public function handle(Request $request)
    {
        [$event, $error] = $this->webhookEvent($request);
        if ($error !== null) {
            return $error;
        }

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
                Log::info('Email opened', ['country' => $this->sanitize($event['country'] ?? ''), 'city' => $this->sanitize($event['city'] ?? '')]);
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
