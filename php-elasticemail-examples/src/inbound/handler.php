<?php
/**
 * Standalone inbound email endpoint.
 *
 * An inbound route with ActionType "NotifyViaHttp" POSTs the parsed message as form fields:
 * from_email, from_name, env_from, env_to_list, to_list, header_list, subject, body_text,
 * body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
 *
 * Verifies ?token=, logs sender and subject, and forwards a copy to CONTACT_EMAIL.
 *
 * Run locally:
 *   php -S localhost:3000 src/inbound/handler.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\TransactionalRecipient;

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$expectedToken = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
if (!hash_equals($expectedToken, (string) ($_GET['token'] ?? ''))) {
    http_response_code(401);
    echo json_encode(['error' => 'Invalid token']);
    exit;
}

$sanitize = fn($value): string => str_replace(["\r", "\n"], '', (string) ($value ?? ''));

$mail = $_POST;
$attachments = [];
foreach ($mail as $key => $value) {
    if (preg_match('/^att\d+_name$/', $key)) {
        $content = $mail[str_replace('_name', '_content', $key)] ?? null;
        if ($content) {
            $attachments[] = new MessageAttachment(['name' => $value, 'binary_content' => $content]);
        }
    }
}

error_log('Inbound email from: ' . $sanitize($mail['from_email'] ?? '') . ' subject: ' . $sanitize($mail['subject'] ?? ''));
error_log('Attachments: ' . (count($attachments) ? implode(', ', array_map(fn($a) => $a->getName(), $attachments)) : 'none'));

$bodyHtml = $mail['body_html'] ?? '';
if ($bodyHtml === '') {
    $bodyHtml = '<pre>' . htmlspecialchars($mail['body_text'] ?? '', ENT_QUOTES) . '</pre>';
}

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

try {
    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [ee_env('CONTACT_EMAIL', ee_from())]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'reply_to' => $mail['from_email'] ?? null,
            'subject' => 'Fwd: ' . ($mail['subject'] ?? '(no subject)'),
            'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $bodyHtml])],
            'attachments' => $attachments,
        ]),
    ]));

    echo json_encode(['received' => true, 'forwardedMessageId' => $result->getMessageId()]);
} catch (Exception $e) {
    $details = ee_error_details($e);
    http_response_code($details['status']);
    echo json_encode(['error' => $details['message']]);
}
