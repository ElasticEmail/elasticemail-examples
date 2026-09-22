<?php
/**
 * Suppressions: unsubscribes, bounces and complaints.
 * Adding an address to any of these lists stops future sends to it.
 *
 * Usage: php src/suppressions/manage.php [email]
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\SuppressionsApi;

$suppressionsApi = new SuppressionsApi(new GuzzleHttp\Client(), ee_config());

$email = $argv[1] ?? 'suppressed@example.com';

try {
    $suppressionsApi->suppressionsUnsubscribesPost([$email]);
    echo "Added to unsubscribes: {$email}\n";
} catch (Exception $e) {
    ee_error($e, 'Error (add unsubscribe)');
}

try {
    $s = $suppressionsApi->suppressionsByEmailGet($email);
    echo 'Suppression: ' . json_encode([
        'Email' => $s->getEmail(),
        'Reason' => $s->getFriendlyErrorMessage(),
        'DateUpdated' => $s->getDateUpdated() ? $s->getDateUpdated()->format('c') : null,
    ]) . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (get suppression)');
}

try {
    $all = $suppressionsApi->suppressionsGet(10, 0);
    echo "\nAll suppressions (first " . count($all) . "):\n";
    foreach ($all as $s) {
        echo ' - ' . $s->getEmail() . ' ' . ($s->getFriendlyErrorMessage() ?? '') . "\n";
    }
} catch (Exception $e) {
    ee_error($e, 'Error (list suppressions)');
}

// Remove it again so the address can receive email
try {
    $suppressionsApi->suppressionsByEmailDelete($email);
    echo "\nRemoved from suppressions: {$email}\n";
} catch (Exception $e) {
    ee_error($e, 'Error (delete suppression)');
}
