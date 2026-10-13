<?php
/**
 * Webhook management: create, list, rotate the signing secret, delete.
 *
 * The webhook is created with signing (EnableSigning) and POST + JSON delivery (PostJson).
 * Every request then carries an HMAC-SHA256 X-ElasticEmail-Signature that the handler
 * verifies with ELASTICEMAIL_WEBHOOK_SECRET (see webhooks/handler.php). The signing secret is
 * returned only when the webhook is created or its secret is rotated. Webhooks created without
 * signing are protected with a ?token= in the URL instead (ELASTICEMAIL_WEBHOOK_TOKEN).
 *
 * Usage: php src/webhooks/manage.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\WebhookApi;
use ElasticEmail\Model\WebhookCreatePayload;
use ElasticEmail\Model\WebhookDeliveryMethod;

$webhookApi = new WebhookApi(new GuzzleHttp\Client(), ee_config());

$publicUrl = ee_env('PUBLIC_URL', 'http://localhost:3000');
$webhookUrl = $publicUrl . '/webhook';

// 1. Create a signed webhook that POSTs JSON. Elastic Email sends a test request on save,
//    so the URL must be reachable (use a tunnel such as ngrok for local development).
//    The test arrives before your endpoint knows the secret; a 401/403 answer to it is
//    accepted, so the create call still succeeds. Signed webhooks don't follow redirects.
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
        'enable_signing' => true,
        'delivery_method' => WebhookDeliveryMethod::POST_JSON,
    ]));
    $webhookId = $webhook->getWebhookId();
    echo 'Webhook created: ' . $webhookId . ' ' . $webhook->getUrl() . "\n";
    echo 'Signing secret: ' . $webhook->getSigningSecret() . "\n";
    echo "Store it as ELASTICEMAIL_WEBHOOK_SECRET - it is shown only once.\n";
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

// 3. Rotate the signing secret. The old secret stops working at once (no grace period).
if ($webhookId) {
    try {
        $rotated = $webhookApi->webhookByPublicidSecretRotatePost($webhookId);
        echo "\nNew signing secret: " . $rotated->getSigningSecret() . "\n";
        echo "Update ELASTICEMAIL_WEBHOOK_SECRET - it is shown only once.\n";
    } catch (Exception $e) {
        ee_error($e, 'Error (rotate webhook secret)');
    }
}

// 4. Delete the one we created (comment out to keep it)
if ($webhookId) {
    try {
        $webhookApi->webhookByPublicidDelete($webhookId);
        echo "\nWebhook deleted: {$webhookId}\n";
    } catch (Exception $e) {
        ee_error($e, 'Error (delete webhook)');
    }
}
