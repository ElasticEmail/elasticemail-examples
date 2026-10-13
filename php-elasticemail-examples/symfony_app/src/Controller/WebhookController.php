<?php

namespace App\Controller;

use App\Service\ElasticEmail;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailsPayload;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\TransactionalRecipient;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Webhook notifications: when ELASTICEMAIL_WEBHOOK_SECRET is set (a webhook created with
 * EnableSigning), each request must carry a valid HMAC-SHA256 X-ElasticEmail-Signature.
 * Without it, and always for inbound email (which is not signed), the shared secret appended
 * to the URL as ?token= is checked against ELASTICEMAIL_WEBHOOK_TOKEN.
 */
class WebhookController
{
    public function __construct(private ElasticEmail $ee)
    {
    }

    private function tokenOk(Request $request): bool
    {
        $expected = $this->ee->env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
        return hash_equals($expected, (string) $request->query->get('token', ''));
    }

    /**
     * Authenticate an Elastic Email notification and return [event, null] or [null, error response].
     * Signed: the event is the JSON body (POST, DeliveryMethod PostJson) or the query string (GET).
     * Field names are lower-cased (GET webhooks send e.g. "Country", PostJson "country").
     */
    private function webhookEvent(Request $request): array
    {
        $secret = $this->ee->env('ELASTICEMAIL_WEBHOOK_SECRET');
        if ($secret !== null) {
            $body = $request->getContent(); // raw body, read before any parsing
            $valid = $this->ee->verifySignature(
                $secret,
                (string) $request->headers->get('X-ElasticEmail-Timestamp', ''),
                (string) $request->headers->get('X-ElasticEmail-Signature', ''),
                $request->getMethod(),
                $request->getRequestUri(), // path + query as received (REQUEST_URI)
                $body
            );
            if (!$valid) {
                return [null, new JsonResponse(['error' => 'Invalid signature'], 401)];
            }
            if (!$request->isMethod('POST')) {
                return [array_change_key_case($request->query->all(), CASE_LOWER), null];
            }
            $event = $body === '' ? [] : json_decode($body, true);
            if (!is_array($event)) {
                return [null, new JsonResponse(['error' => 'Invalid JSON body'], 400)];
            }
            return [array_change_key_case($event, CASE_LOWER), null];
        }

        if (!$this->tokenOk($request)) {
            return [null, new JsonResponse(['error' => 'Invalid token'], 401)];
        }
        return [array_change_key_case(array_merge($request->query->all(), $request->request->all()), CASE_LOWER), null];
    }

    private function sanitize($value): string
    {
        return str_replace(["\r", "\n"], '', (string) ($value ?? ''));
    }

    private function fail(\Exception $e): JsonResponse
    {
        $details = $this->ee->errorDetails($e);
        return new JsonResponse(['error' => $details['message']], $details['status']);
    }

    /**
     * Event notifications. Fields: transaction, messageid, to, from, subject, date, status,
     * category, channel, target, ip, useragent, country, city. Signed PostJson webhooks send them
     * as a JSON body, Get webhooks in the query string. Elastic Email sends a test request on save.
     */
    public function handle(Request $request): JsonResponse
    {
        [$event, $error] = $this->webhookEvent($request);
        if ($error !== null) {
            return $error;
        }

        $status = $this->sanitize($event['status'] ?? '');

        if ($status === '') {
            return new JsonResponse(['ok' => true]);
        }

        error_log(sprintf('Webhook event: %s to: %s transaction: %s', $status, $this->sanitize($event['to'] ?? ''), $this->sanitize($event['transaction'] ?? '')));

        switch ($status) {
            case 'Sent':
                error_log('Email sent, message id: ' . $this->sanitize($event['messageid'] ?? ''));
                break;
            case 'Opened':
                error_log('Email opened from ' . $this->sanitize($event['country'] ?? '') . ' ' . $this->sanitize($event['city'] ?? ''));
                break;
            case 'Clicked':
                error_log('Link clicked: ' . $this->sanitize($event['target'] ?? ''));
                break;
            case 'Error':
                error_log('Bounce/error, category: ' . $this->sanitize($event['category'] ?? ''));
                break;
            case 'AbuseReport':
                error_log('Complaint received');
                break;
            case 'Unsubscribed':
                error_log('Recipient unsubscribed');
                break;
        }

        return new JsonResponse(['received' => true, 'status' => $status]);
    }

    /**
     * Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
     * Form fields: from_email, from_name, subject, body_text, body_html, att1_name/att1_content (base64), ...
     * Forwards a copy to CONTACT_EMAIL.
     */
    public function inbound(Request $request): JsonResponse
    {
        if (!$this->tokenOk($request)) {
            return new JsonResponse(['error' => 'Invalid token'], 401);
        }

        $mail = $request->request->all();
        $attachments = [];
        foreach ($mail as $key => $value) {
            if (preg_match('/^att\d+_name$/', $key)) {
                $content = $mail[str_replace('_name', '_content', $key)] ?? null;
                if ($content) {
                    $attachments[] = new MessageAttachment(['name' => $value, 'binary_content' => $content]);
                }
            }
        }

        error_log('Inbound email from: ' . $this->sanitize($mail['from_email'] ?? '') . ' subject: ' . $this->sanitize($mail['subject'] ?? ''));

        $bodyHtml = $mail['body_html'] ?? '';
        if ($bodyHtml === '') {
            $bodyHtml = '<pre>' . htmlspecialchars($mail['body_text'] ?? '', ENT_QUOTES) . '</pre>';
        }

        try {
            $result = $this->ee->emails()->emailsTransactionalPost(new EmailTransactionalMessageData([
                'recipients' => new TransactionalRecipient(['to' => [$this->ee->env('CONTACT_EMAIL', $this->ee->from())]]),
                'content' => new EmailContent([
                    'from' => $this->ee->from(),
                    'reply_to' => $mail['from_email'] ?? null,
                    'subject' => 'Fwd: ' . ($mail['subject'] ?? '(no subject)'),
                    'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $bodyHtml])],
                    'attachments' => $attachments,
                ]),
            ]));

            return new JsonResponse(['received' => true, 'forwardedMessageId' => $result->getMessageId()]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Click-tracking based double opt-in: on status=Clicked with the confirm URL in "target",
     * add the recipient to the list.
     */
    public function doubleOptin(Request $request): JsonResponse
    {
        [$event, $error] = $this->webhookEvent($request);
        if ($error !== null) {
            return $error;
        }

        $status = $this->sanitize($event['status'] ?? '');
        if ($status === '') {
            return new JsonResponse(['ok' => true]);
        }
        $target = (string) ($event['target'] ?? '');
        $recipient = $this->sanitize($event['to'] ?? '');
        $listName = $this->ee->env('ELASTICEMAIL_LIST_NAME', 'Newsletter');

        if ($status !== 'Clicked' || !str_contains($target, '/double-optin/confirm')) {
            return new JsonResponse(['received' => true, 'status' => $status, 'message' => 'Event ignored']);
        }

        try {
            $this->ee->lists()->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$recipient]]));
            return new JsonResponse(['received' => true, 'confirmed' => true, 'email' => $recipient, 'list' => $listName]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
