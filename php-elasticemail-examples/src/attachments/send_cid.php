<?php
/**
 * Send an email with an inline (CID) image.
 *
 * Elastic Email derives the Content-ID of an attachment from its file name.
 * Reference the attachment name after "cid:" to embed it inline.
 *
 * Usage: php src/attachments/send_cid.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\TransactionalRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

// Minimal 1x1 PNG placeholder (base64-encoded)
$placeholderImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

$html = <<<HTML
<div style="font-family: Arial, sans-serif; padding: 20px;">
  <img src="cid:logo.png" alt="Company Logo" width="100" height="100" />
  <h1>Welcome!</h1>
  <p>This email contains an inline image referenced by Content-ID.</p>
</div>
HTML;

try {
    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [ee_to()]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'subject' => 'Email with Inline Image',
            'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $html])],
            'attachments' => [
                new MessageAttachment([
                    'binary_content' => $placeholderImage,
                    'name' => 'logo.png',
                    'content_type' => 'image/png',
                ]),
            ],
        ]),
    ]));

    echo "Email with inline image sent successfully!\n";
    echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
    echo 'Message ID: ' . $result->getMessageId() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error sending email');
}
