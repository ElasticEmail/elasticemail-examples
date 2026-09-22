<?php
/**
 * Scheduled send.
 *
 * TimeOffset delays delivery by N minutes from now. Maximum is 35 days (50400 minutes).
 * Elastic Email has no cancel endpoint for a single delayed email, so pick the offset carefully.
 *
 * Usage: php src/scheduling/send.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\Options;
use ElasticEmail\Model\TransactionalRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

$delayMinutes = 60;
$scheduledFor = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->modify("+{$delayMinutes} minutes")->format('c');

try {
    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [ee_to()]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'subject' => 'Scheduled Email',
            'body' => [
                new BodyPart([
                    'content_type' => 'HTML',
                    'content' => "<h1>Scheduled Email</h1><p>This email was scheduled for {$scheduledFor}.</p>",
                ]),
            ],
        ]),
        'options' => new Options(['time_offset' => $delayMinutes]),
    ]));

    echo "Email scheduled for {$scheduledFor}\n";
    echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
    echo 'Message ID: ' . $result->getMessageId() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error scheduling email');
}
