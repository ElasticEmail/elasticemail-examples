<?php
/**
 * Email verification. This is a paid feature; accounts without it get a 4xx here.
 *
 * Usage: php src/verification/verify.php someone@example.com
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\VerificationsApi;

$verificationsApi = new VerificationsApi(new GuzzleHttp\Client(), ee_config());

$email = $argv[1] ?? ee_to();

try {
    $verificationsApi->verificationsByEmailPost($email);
    $result = $verificationsApi->verificationsByEmailGet($email);

    echo "=== Verification result ===\n";
    echo 'Email:       ' . $result->getEmail() . "\n";
    echo 'Result:      ' . $result->getResult() . "\n";
    echo 'Reason:      ' . ($result->getReason() ?? '') . "\n";
    echo 'Disposable:  ' . var_export((bool) $result->getDisposable(), true) . "\n";
    echo 'Role:        ' . var_export((bool) $result->getRole(), true) . "\n";
    if ($result->getSuggestedSpelling()) {
        echo 'Did you mean: ' . $result->getSuggestedSpelling() . "\n";
    }
} catch (Exception $e) {
    ee_error($e, 'Error verifying email');
}
