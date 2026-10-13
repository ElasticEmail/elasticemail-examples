<?php
/**
 * Standalone webhook endpoint for Elastic Email event notifications.
 *
 * Fields: transaction, messageid, to, from, subject, date, status (Sent, Opened, Clicked,
 * Error, AbuseReport, Unsubscribed), category, channel, target (clicked URL), ip, useragent,
 * country, city. A signed webhook with DeliveryMethod PostJson sends them as a JSON body,
 * a Get webhook in the query string.
 *
 * Signed webhooks (recommended): set ELASTICEMAIL_WEBHOOK_SECRET to the SigningSecret printed
 * by src/webhooks/manage.php. Every request must then carry a valid X-ElasticEmail-Signature,
 * otherwise it gets 401 (Elastic Email retries). Unsigned webhooks: leave the secret empty and
 * register PUBLIC_URL/webhook?token=<ELASTICEMAIL_WEBHOOK_TOKEN>.
 *
 * Elastic Email sends a test request when the webhook is saved; a request without a status
 * answers 200.
 *
 * Run locally:
 *   php -S localhost:3000 src/webhooks/handler.php
 */

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

[$event, $error] = ee_webhook_event_from_globals();
if ($error !== null) {
    http_response_code($error['status']);
    echo json_encode(['error' => $error['error']]);
    exit;
}

$sanitize = fn($value): string => str_replace(["\r", "\n"], '', (string) ($value ?? ''));

$status = $sanitize($event['status'] ?? '');

if ($status === '') {
    // Validation ping or empty request
    echo json_encode(['ok' => true]);
    exit;
}

error_log(sprintf('Webhook event: %s to: %s transaction: %s', $status, $sanitize($event['to'] ?? ''), $sanitize($event['transaction'] ?? '')));

switch ($status) {
    case 'Sent':
        error_log('Email sent, message id: ' . $sanitize($event['messageid'] ?? ''));
        break;
    case 'Opened':
        error_log('Email opened from ' . $sanitize($event['country'] ?? '') . ' ' . $sanitize($event['city'] ?? ''));
        break;
    case 'Clicked':
        error_log('Link clicked: ' . $sanitize($event['target'] ?? ''));
        break;
    case 'Error':
        error_log('Bounce/error, category: ' . $sanitize($event['category'] ?? ''));
        break;
    case 'AbuseReport':
        error_log('Complaint received');
        break;
    case 'Unsubscribed':
        error_log('Recipient unsubscribed');
        break;
}

echo json_encode(['received' => true, 'status' => $status]);
