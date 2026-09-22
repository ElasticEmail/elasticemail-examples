<?php
/**
 * Send an email with a file attachment.
 *
 * BinaryContent is base64. Total message size limit applies (see account limits).
 *
 * Usage: php src/attachments/send.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\TransactionalRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

$fileContent = "Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: " . date('c') . "\n";

try {
    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [ee_to()]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'subject' => 'Email with Attachment',
            'body' => [
                new BodyPart([
                    'content_type' => 'HTML',
                    'content' => '<h1>Your attachment is ready</h1><p>Please find the file attached to this email.</p>',
                ]),
            ],
            'attachments' => [
                new MessageAttachment([
                    'binary_content' => base64_encode($fileContent),
                    'name' => 'sample.txt',
                    'content_type' => 'text/plain',
                ]),
            ],
        ]),
    ]));

    echo "Email with attachment sent successfully!\n";
    echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
    echo 'Message ID: ' . $result->getMessageId() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error sending email');
}
