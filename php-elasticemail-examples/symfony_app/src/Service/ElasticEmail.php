<?php

namespace App\Service;

use ElasticEmail\Api\ContactsApi;
use ElasticEmail\Api\DomainsApi;
use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Api\ListsApi;
use ElasticEmail\Api\TemplatesApi;
use ElasticEmail\ApiException;
use ElasticEmail\Configuration;
use GuzzleHttp\Client;

/**
 * Thin wrapper around the Elastic Email SDK: configuration, API instances and env values.
 */
class ElasticEmail
{
    private Configuration $config;

    public function __construct()
    {
        $apiKey = $this->env('ELASTICEMAIL_API_KEY');
        if (!$apiKey) {
            throw new \RuntimeException('ELASTICEMAIL_API_KEY is not set. Copy ../.env.example to ../.env and add your key.');
        }
        $this->config = Configuration::getDefaultConfiguration()->setApiKey('X-ElasticEmail-ApiKey', $apiKey);
    }

    public function env(string $name, ?string $default = null): ?string
    {
        $value = $_ENV[$name] ?? $_SERVER[$name] ?? getenv($name);
        if ($value === false || $value === null || $value === '') {
            return $default;
        }
        return (string) $value;
    }

    public function from(): string
    {
        return $this->env('EMAIL_FROM', 'Acme <hello@yourdomain.com>');
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
}
