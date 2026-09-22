<?php
/**
 * Double opt-in: confirm endpoint.
 *
 * GET /double-optin/confirm?email=...&token=...
 * Validates the HMAC created by subscribe.php and adds the contact to ELASTICEMAIL_LIST_NAME.
 * Redirects to CONFIRM_REDIRECT_URL when set, otherwise returns JSON.
 *
 * Run locally:
 *   php -S localhost:3000 src/double-optin/confirm.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\ListsApi;
use ElasticEmail\Model\EmailsPayload;

$listName = ee_env('ELASTICEMAIL_LIST_NAME', 'Newsletter');
$secret = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
$redirectUrl = ee_env('CONFIRM_REDIRECT_URL');

$email = (string) ($_GET['email'] ?? '');
$token = (string) ($_GET['token'] ?? '');

if ($email === '' || !hash_equals(hash_hmac('sha256', $email, $secret), $token)) {
    http_response_code(400);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Invalid confirmation link']);
    exit;
}

$listsApi = new ListsApi(new GuzzleHttp\Client(), ee_config());

try {
    $listsApi->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$email]]));
    error_log("Subscription confirmed: {$email} -> {$listName}");

    if ($redirectUrl) {
        header('Location: ' . $redirectUrl, true, 302);
        exit;
    }

    header('Content-Type: application/json');
    echo json_encode(['confirmed' => true, 'email' => $email, 'list' => $listName]);
} catch (Exception $e) {
    $details = ee_error_details($e);
    http_response_code($details['status']);
    header('Content-Type: application/json');
    echo json_encode(['error' => $details['message']]);
}
