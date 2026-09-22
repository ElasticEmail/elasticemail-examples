<?php
/**
 * Standalone webhook endpoint for Elastic Email event notifications.
 *
 * Parameters arrive in the query string (GET) or as form fields (POST): transaction,
 * messageid, to, from, subject, date, status (Sent, Opened, Clicked, Error, AbuseReport,
 * Unsubscribed), category, channel, target (clicked URL), IP, Useragent, Country, City.
 *
 * Elastic Email sends a GET to validate the URL when the webhook is saved, so GET
 * without a status answers 200.
 *
 * Run locally:
 *   php -S localhost:3000 src/webhooks/handler.php
 * and register PUBLIC_URL/webhook?token=... with src/webhooks/manage.php.
 */

require_once __DIR__ . '/../bootstrap.php';

header('Content-Type: application/json');

$expectedToken = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
$givenToken = (string) ($_GET['token'] ?? '');

if (!hash_equals($expectedToken, $givenToken)) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid token']);
    exit;
}

$sanitize = fn($value): string => str_replace(["\r", "\n"], '', (string) ($value ?? ''));

$event = array_merge($_GET, $_POST);
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
        error_log('Email opened from ' . $sanitize($event['Country'] ?? '') . ' ' . $sanitize($event['City'] ?? ''));
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
