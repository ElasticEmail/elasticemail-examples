<?php

namespace App\Services;

use ElasticEmail\Api\ContactsApi;
use ElasticEmail\Api\DomainsApi;
use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Api\ListsApi;
use ElasticEmail\Api\TemplatesApi;
use ElasticEmail\ApiException;
use ElasticEmail\Configuration;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailSend;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\Options;
use ElasticEmail\Model\TransactionalRecipient;
use GuzzleHttp\Client;

/**
 * Thin wrapper around the Elastic Email SDK. Builds the Configuration from config/elasticemail.php
 * and exposes API instances. Registered as a singleton by Laravel's container (autowired).
 */
class ElasticEmail
{
    private Configuration $config;

    public function __construct()
    {
        $apiKey = config('elasticemail.api_key');
        if (!$apiKey) {
            throw new \RuntimeException('ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env and add your key.');
        }
        $this->config = Configuration::getDefaultConfiguration()->setApiKey('X-ElasticEmail-ApiKey', $apiKey);
    }

    public function from(): string
    {
        return config('elasticemail.from');
    }

    public function emails(): EmailsApi
    {
        return new EmailsApi(new Client(), $this->config);
    }

    public function contacts(): ContactsApi
    {
        return new ContactsApi(new Client(), $this->config);
    }

    public function lists(): ListsApi
    {
        return new ListsApi(new Client(), $this->config);
    }

    public function domains(): DomainsApi
    {
        return new DomainsApi(new Client(), $this->config);
    }

    public function templates(): TemplatesApi
    {
        return new TemplatesApi(new Client(), $this->config);
    }

    /**
     * Send a single HTML email. Extra EmailContent keys (snake_case, e.g. attachments,
     * headers, reply_to) go in $extraContent; Options (e.g. time_offset) in $options.
     */
    public function sendHtml(string $to, string $subject, string $html, array $extraContent = [], ?Options $options = null, ?string $idempotencyKey = null): EmailSend
    {
        $content = array_merge([
            'from' => $this->from(),
            'subject' => $subject,
            'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $html])],
        ], $extraContent);

        $data = [
            'recipients' => new TransactionalRecipient(['to' => [$to]]),
            'content' => new EmailContent($content),
        ];
        if ($options) {
            $data['options'] = $options;
        }

        return $this->emails()->emailsTransactionalPost(new EmailTransactionalMessageData($data), $idempotencyKey);
    }

    /**
     * HTTP status and message from an API failure. Response body shape is {"Error": "..."}.
     *
     * @return array{status:int, message:string}
     */
    public function errorDetails(\Exception $e): array
    {
        if ($e instanceof ApiException) {
            $body = $e->getResponseBody();
            $decoded = is_string($body) ? json_decode($body, true) : (array) $body;
            $message = is_array($decoded) && isset($decoded['Error']) ? (string) $decoded['Error'] : (string) ($body ?: $e->getMessage());
            $status = $e->getCode() >= 400 ? $e->getCode() : 500;
            return ['status' => $status, 'message' => $message];
        }
        return ['status' => 500, 'message' => $e->getMessage()];
    }

    /**
     * Constant-time check of the shared secret carried in ?token=.
     */
    public function tokenOk(?string $token): bool
    {
        return hash_equals((string) config('elasticemail.webhook_token'), (string) $token);
    }

    /**
     * Check the X-ElasticEmail-Signature of a signed webhook request.
     *
     * Signed message: "{timestamp}\n{METHOD}\n{target}\n{body}", HMAC-SHA256 with the secret,
     * lowercase hex. $target is the path + query exactly as received (still URL-encoded),
     * $body the raw body ('' for GET). Any matching v1= entry of the header is accepted.
     */
    public function verifySignature(string $secret, string $timestamp, string $signatureHeader, string $method, string $target, string $body, ?int $now = null): bool
    {
        if (!ctype_digit($timestamp) || abs(($now ?? time()) - (int) $timestamp) > 300) {
            return false;
        }

        $expected = hash_hmac('sha256', $timestamp . "\n" . strtoupper($method) . "\n" . $target . "\n" . $body, $secret);

        foreach (explode(',', $signatureHeader) as $part) {
            $part = trim($part);
            if (str_starts_with($part, 'v1=') && hash_equals($expected, substr($part, 3))) {
                return true;
            }
        }
        return false;
    }

    /**
     * HMAC used in double opt-in confirm links.
     */
    public function hmac(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('elasticemail.webhook_token'));
    }
}
