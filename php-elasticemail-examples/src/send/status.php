<?php
/**
 * Delivery status for a transaction, and optionally the message itself.
 * Both ids are returned by every send call.
 *
 * Usage: php src/send/status.php <transactionId> [messageId]
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;

$transactionId = $argv[1] ?? null;
$messageId = $argv[2] ?? null;

if (!$transactionId) {
    fwrite(STDERR, "Usage: php src/send/status.php <transactionId> [messageId]\n");
    exit(1);
}

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

try {
    $status = $emailsApi->emailsByTransactionidStatusGet(
        $transactionId,
        true, // showFailed
        true, // showSent
        true, // showDelivered
        true, // showPending
        true, // showOpened
        true  // showClicked
    );

    echo "=== Transaction status ===\n";
    echo 'Status:      ' . $status->getStatus() . "\n";
    echo 'Recipients:  ' . $status->getRecipientsCount() . "\n";
    echo 'Sent:        ' . $status->getSentCount() . ' ' . json_encode($status->getSent() ?? []) . "\n";
    echo 'Delivered:   ' . $status->getDeliveredCount() . ' ' . json_encode($status->getDelivered() ?? []) . "\n";
    echo 'Pending:     ' . $status->getPendingCount() . "\n";
    echo 'Opened:      ' . $status->getOpenedCount() . "\n";
    echo 'Clicked:     ' . $status->getClickedCount() . "\n";
    echo 'Failed:      ' . $status->getFailedCount() . ' ' . json_encode($status->getFailed() ?? []) . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error fetching status');
}

if ($messageId) {
    try {
        $message = $emailsApi->emailsByMsgidViewGet($messageId);
        $preview = $message->getPreview();
        $state = $message->getStatus();

        echo "\n=== Message ===\n";
        echo 'From:    ' . ($preview ? $preview->getFrom() : '') . "\n";
        echo 'Subject: ' . ($preview ? $preview->getSubject() : '') . "\n";
        echo 'Status:  ' . ($state ? $state->getStatusName() . ' ' . ($state->getDateSent() ? $state->getDateSent()->format('c') : '') : '') . "\n";
        $body = $preview ? (string) $preview->getBody() : '';
        echo 'Body preview: ' . (mb_strlen($body) > 200 ? mb_substr($body, 0, 200) . '...' : $body) . "\n";
    } catch (Exception $e) {
        ee_error($e, 'Error fetching message', false);
    }
}
