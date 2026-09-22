<?php
/**
 * Webhook management: create, list, delete.
 *
 * Elastic Email does not sign webhook requests. The examples append a shared secret
 * as a query parameter and the receiving handler checks it (see webhooks/handler.php).
 *
 * Usage: php src/webhooks/manage.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\WebhookApi;
use ElasticEmail\Model\WebhookCreatePayload;

$webhookApi = new WebhookApi(new GuzzleHttp\Client(), ee_config());

$publicUrl = ee_env('PUBLIC_URL', 'http://localhost:3000');
$token = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
$webhookUrl = $publicUrl . '/webhook?token=' . rawurlencode($token);

// 1. Create. Elastic Email sends a GET to the URL on save, so the handler must be reachable
//    and answer 2xx (use a tunnel such as ngrok for local development).
$webhookId = null;
try {
    $webhook = $webhookApi->webhookPost(new WebhookCreatePayload([
        'name' => 'examples-webhook',
        'url' => $webhookUrl,
        'notify_once_per_email' => false,
        'notification_for_sent' => true,
        'notification_for_opened' => true,
        'notification_for_clicked' => true,
        'notification_for_unsubscribed' => true,
        'notification_for_abuse_report' => true,
        'notification_for_error' => true,
    ]));
    $webhookId = $webhook->getWebhookId();
    echo 'Webhook created: ' . $webhookId . ' ' . $webhook->getUrl() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (create webhook)');
}

// 2. List
try {
    $webhooks = $webhookApi->webhookGet(50, 0);
    echo "\nWebhooks (" . count($webhooks) . "):\n";
    foreach ($webhooks as $w) {
        printf(" - %s %s %s enabled=%s\n", $w->getWebhookId(), $w->getName(), $w->getUrl(), var_export((bool) $w->getIsEnabled(), true));
    }
} catch (Exception $e) {
    ee_error($e, 'Error (list webhooks)');
}

// 3. Delete the one we created (comment out to keep it)
if ($webhookId) {
    try {
        $webhookApi->webhookByPublicidDelete($webhookId);
        echo "\nWebhook deleted: {$webhookId}\n";
    } catch (Exception $e) {
        ee_error($e, 'Error (delete webhook)');
    }
}
