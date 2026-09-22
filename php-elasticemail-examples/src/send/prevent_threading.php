<?php
/**
 * Prevent Gmail threading.
 *
 * Gmail groups emails into threads based on subject and Message-ID/References headers.
 * A unique X-Entity-Ref-ID header per email prevents this grouping.
 *
 * Usage: php src/send/prevent_threading.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\TransactionalRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

function uuid4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
}

for ($i = 1; $i <= 3; $i++) {
    try {
        $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
            'recipients' => new TransactionalRecipient(['to' => [ee_to()]]),
            'content' => new EmailContent([
                'from' => ee_from(),
                'subject' => 'Order Confirmation', // same subject for all
                'body' => [
                    new BodyPart([
                        'content_type' => 'HTML',
                        'content' => "<h1>Order Confirmation</h1><p>This is email #{$i}. Each appears as a separate conversation in Gmail.</p>",
                    ]),
                ],
                'headers' => ['X-Entity-Ref-ID' => uuid4()],
            ]),
        ]));

        echo "Email #{$i} sent: " . $result->getMessageId() . "\n";
    } catch (Exception $e) {
        ee_error($e, "Error sending email #{$i}");
    }
}

echo "\nAll emails sent with unique X-Entity-Ref-ID headers.\n";
