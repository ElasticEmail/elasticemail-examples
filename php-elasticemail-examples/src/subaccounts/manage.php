<?php
/**
 * Sub-accounts let you isolate customers or projects with their own API keys and credits.
 * Creating one affects billing, so this script only reads unless CREATE_SUBACCOUNT=true.
 *
 * Usage:
 *   php src/subaccounts/manage.php
 *   CREATE_SUBACCOUNT=true php src/subaccounts/manage.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\SubAccountsApi;
use ElasticEmail\Model\SubaccountEmailCreditsPayload;
use ElasticEmail\Model\SubaccountPayload;

$subAccountsApi = new SubAccountsApi(new GuzzleHttp\Client(), ee_config());

$createEnabled = ee_env('CREATE_SUBACCOUNT') === 'true';
$subEmail = ee_env('SUBACCOUNT_EMAIL', 'sub-' . time() . '@example.com');

try {
    $accounts = $subAccountsApi->subaccountsGet(20, 0);
    echo 'Sub-accounts (' . count($accounts) . "):\n";
    foreach ($accounts as $s) {
        printf(" - %s status=%s credits=%s sent=%s\n", $s->getEmail(), $s->getStatus(), $s->getEmailCredits(), $s->getTotalEmailsSent());
    }
} catch (Exception $e) {
    ee_error($e, 'Error (list sub-accounts)');
}

if (!$createEnabled) {
    echo "\nSet CREATE_SUBACCOUNT=true to create a sub-account and assign credits.\n";
    exit(0);
}

try {
    $created = $subAccountsApi->subaccountsPost(new SubaccountPayload([
        'email' => $subEmail,
        'password' => 'Tmp-' . bin2hex(random_bytes(6)) . '-Aa1!',
        'send_activation' => false,
    ]));
    echo "\nSub-account created: " . $created->getEmail() . "\n";

    $subAccountsApi->subaccountsByEmailCreditsPatch($subEmail, new SubaccountEmailCreditsPayload([
        'credits' => 1000,
        'notes' => 'Initial allocation',
    ]));
    echo "Assigned 1000 credits to {$subEmail}\n";

    $key = $subAccountsApi->subaccountsByEmailApikeyGet($subEmail);
    echo 'Sub-account API key retrieved (length): ' . strlen((string) $key) . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (create sub-account)');
}
