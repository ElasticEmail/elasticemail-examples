<?php
/**
 * Basic transactional send with the Elastic Email PHP SDK.
 *
 * Usage: php src/send/basic.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\TransactionalRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

try {
    // Up to 50 recipients per transactional call.
    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [ee_to()]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'subject' => 'Hello from Elastic Email!',
            'body' => [
                new BodyPart([
                    'content_type' => 'HTML',
                    'content' => '<h1>Welcome!</h1><p>This email was sent using the Elastic Email PHP SDK.</p>',
                ]),
                new BodyPart([
                    'content_type' => 'PlainText',
                    'content' => 'Welcome! This email was sent using the Elastic Email PHP SDK.',
                ]),
            ],
        ]),
    ]));

    echo "Email sent successfully!\n";
    echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
    echo 'Message ID: ' . $result->getMessageId() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error sending email');
}
