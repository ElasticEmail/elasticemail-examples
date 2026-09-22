<?php
/**
 * Domain management: add a sending domain and check its DNS verification state.
 *
 * Usage: php src/domains/manage.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\DomainsApi;
use ElasticEmail\Model\DomainPayload;

$domainsApi = new DomainsApi(new GuzzleHttp\Client(), ee_config());

$domain = ee_env('SENDING_DOMAIN', 'yourdomain.com');

$flag = fn($value) => $value ? 'ok' : 'missing';

// 1. Add the domain
try {
    $domainsApi->domainsPost(new DomainPayload(['domain' => $domain]));
    echo "Domain \"{$domain}\" added.\n";
} catch (Exception $e) {
    if (ee_already_exists($e)) {
        echo "Domain \"{$domain}\" already exists.\n";
    } else {
        ee_error($e, 'Error (add domain)');
    }
}

// 2. Show DNS verification state. Add the records shown in the dashboard, then re-run.
try {
    $detail = $domainsApi->domainsByDomainGet($domain);
    echo "\nVerification status:\n";
    echo '  SPF:       ' . $flag($detail->getSpf()) . "\n";
    echo '  DKIM:      ' . $flag($detail->getDkim()) . "\n";
    echo '  MX:        ' . $flag($detail->getMx()) . "\n";
    echo '  DMARC:     ' . $flag($detail->getDmarc()) . "\n";
    echo '  Tracking:  ' . ($detail->getTrackingStatus() ?? 'n/a') . "\n";
    echo '  Default:   ' . ($detail->getDefaultDomain() ? 'yes' : 'no') . "\n";
    if ($detail->getDkimRecord()) {
        echo "\nDKIM record to publish: " . json_encode($detail->getDkimRecord()) . "\n";
    }
} catch (Exception $e) {
    ee_error($e, 'Error (get domain)');
}

// 3. List all domains
try {
    $domains = $domainsApi->domainsGet();
    echo "\nDomains on the account (" . count($domains) . "):\n";
    foreach ($domains as $d) {
        printf(" - %s spf=%s dkim=%s default=%s\n",
            $d->getDomain(),
            var_export((bool) $d->getSpf(), true),
            var_export((bool) $d->getDkim(), true),
            var_export((bool) $d->getDefaultDomain(), true)
        );
    }
} catch (Exception $e) {
    ee_error($e, 'Error (list domains)');
}

// 4. Optional: verify tracking (CNAME must point at the Elastic Email tracking host)
// $domainsApi->domainsByDomainVerificationPut($domain, 'Http');

// 5. Optional: set the default sender for the account
// $domainsApi->domainsByEmailDefaultPatch("hello@{$domain}");

echo "\nDone.\n";
