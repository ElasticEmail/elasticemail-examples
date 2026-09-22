<?php
/**
 * Double opt-in: click-tracking based confirmation.
 *
 * Alternative to confirm.php driven by Elastic Email click tracking. Create a webhook
 * (see webhooks/manage.php) pointing at this endpoint. When the recipient clicks the
 * confirm link, Elastic Email reports status=Clicked with the clicked URL in "target",
 * and the contact is added to the list.
 *
 * Run locally:
 *   php -S localhost:3000 src/double-optin/webhook.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\ListsApi;
use ElasticEmail\Model\EmailsPayload;

header('Content-Type: application/json');

$listName = ee_env('ELASTICEMAIL_LIST_NAME', 'Newsletter');
$expectedToken = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');

if (!hash_equals($expectedToken, (string) ($_GET['token'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid token']);
    exit;
}

// Elastic Email validates the URL with a GET when the webhook is saved.
if ($_SERVER['REQUEST_METHOD'] === 'GET' && !isset($_GET['status'])) {
    echo json_encode(['ok' => true]);
    exit;
}

$sanitize = fn($value): string => str_replace(["\r", "\n"], '', (string) ($value ?? ''));

$event = array_merge($_GET, $_POST);
$status = $sanitize($event['status'] ?? '');
$target = $sanitize($event['target'] ?? '');
$recipient = $sanitize($event['to'] ?? '');

if ($status !== 'Clicked' || !str_contains($target, '/double-optin/confirm')) {
    echo json_encode(['received' => true, 'status' => $status, 'message' => 'Event ignored']);
    exit;
}

$listsApi = new ListsApi(new GuzzleHttp\Client(), ee_config());

try {
    $listsApi->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$recipient]]));
    error_log("Subscription confirmed via click: {$recipient}");
    echo json_encode(['received' => true, 'confirmed' => true, 'email' => $recipient, 'list' => $listName]);
} catch (Exception $e) {
    $details = ee_error_details($e);
    http_response_code($details['status']);
    echo json_encode(['error' => $details['message']]);
}
