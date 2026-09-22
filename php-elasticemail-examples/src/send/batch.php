<?php
/**
 * Bulk send: one API call, one personalized email per recipient.
 *
 * Values from each recipient's "fields" replace {placeholders} in the subject and body.
 * Up to 1000 recipients per request.
 *
 * Usage: php src/send/batch.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailMessageData;
use ElasticEmail\Model\EmailRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

$recipients = [
    new EmailRecipient(['email' => ee_to(), 'fields' => ['firstname' => 'Ann', 'plan' => 'Pro']]),
    new EmailRecipient(['email' => ee_to(), 'fields' => ['firstname' => 'Ben', 'plan' => 'Starter']]),
    new EmailRecipient(['email' => ee_to(), 'fields' => ['firstname' => 'Cleo', 'plan' => 'Team']]),
];

try {
    $result = $emailsApi->emailsPost(new EmailMessageData([
        'recipients' => $recipients,
        'content' => new EmailContent([
            'from' => ee_from(),
            'subject' => 'Hi {firstname}, your {plan} plan is ready',
            'body' => [
                new BodyPart([
                    'content_type' => 'HTML',
                    'content' => '<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>',
                ]),
                new BodyPart([
                    'content_type' => 'PlainText',
                    'content' => 'Hi {firstname}! Your {plan} plan is now active.',
                ]),
            ],
        ]),
    ]));

    echo 'Bulk email queued for ' . count($recipients) . " recipients.\n";
    echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
    echo 'Check delivery with: php src/send/status.php ' . $result->getTransactionId() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error sending bulk email');
}
