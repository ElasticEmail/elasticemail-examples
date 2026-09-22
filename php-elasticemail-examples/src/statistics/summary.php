<?php
/**
 * Account-wide sending statistics for the last 30 days.
 * Dates are ISO 8601 without timezone (YYYY-MM-DDThh:mm:ss), interpreted as UTC.
 *
 * Usage: php src/statistics/summary.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\StatisticsApi;

$statisticsApi = new StatisticsApi(new GuzzleHttp\Client(), ee_config());

$to = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$from = $to->modify('-30 days');
$fromIso = $from->format('Y-m-d\TH:i:s');
$toIso = $to->format('Y-m-d\TH:i:s');

try {
    $stats = $statisticsApi->statisticsGet($fromIso, $toIso);

    echo "=== Statistics {$fromIso} to {$toIso} ===\n";
    echo 'Recipients:    ' . $stats->getRecipients() . "\n";
    echo 'Emails total:  ' . $stats->getEmailTotal() . "\n";
    echo 'Delivered:     ' . $stats->getDelivered() . "\n";
    echo 'Bounced:       ' . $stats->getBounced() . "\n";
    echo 'In progress:   ' . $stats->getInProgress() . "\n";
    echo 'Opened:        ' . $stats->getOpened() . "\n";
    echo 'Clicked:       ' . $stats->getClicked() . "\n";
    echo 'Unsubscribed:  ' . $stats->getUnsubscribed() . "\n";
    echo 'Complaints:    ' . $stats->getComplaints() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error fetching statistics');
}
