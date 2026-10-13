<?php
/**
 * Shared setup for the standalone examples and the Slim app.
 *
 * Loads .env, builds the Elastic Email Configuration and exposes a few helpers.
 * Every script does: require_once __DIR__ . '/../bootstrap.php';
 */

require_once __DIR__ . '/../vendor/autoload.php';

use ElasticEmail\ApiException;
use ElasticEmail\Configuration;

$dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
$dotenv->safeLoad();

/**
 * Read an env value from $_ENV, getenv() or a default.
 */
function ee_env(string $name, ?string $default = null): ?string
{
    $value = $_ENV[$name] ?? getenv($name);
    if ($value === false || $value === null || $value === '') {
        return $default;
    }
    return (string) $value;
}

/**
 * Write one line to stderr (CLI) or the server log (php -S / web).
 */
function ee_stderr(string $line): void
{
    if (defined('STDERR')) {
        fwrite(STDERR, $line . "\n");
    } else {
        error_log($line);
    }
}

/**
 * Configuration with the API key from ELASTICEMAIL_API_KEY. Exits if the key is missing.
 */
function ee_config(): Configuration
{
    static $config = null;
    if ($config === null) {
        $apiKey = ee_env('ELASTICEMAIL_API_KEY');
        if (!$apiKey || $apiKey === 'your_api_key') {
            ee_stderr("ELASTICEMAIL_API_KEY is not set. Copy .env.example to .env and add your key.");
            exit(1);
        }
        $config = Configuration::getDefaultConfiguration()->setApiKey('X-ElasticEmail-ApiKey', $apiKey);
    }
    return $config;
}

function ee_from(): string
{
    return ee_env('EMAIL_FROM', 'Acme <hello@yourdomain.com>');
}

function ee_to(): string
{
    return ee_env('EMAIL_TO', 'you@yourdomain.com');
}

/**
 * HTTP status and message from an API failure. Response body shape is {"Error": "..."}.
 *
 * @return array{status:int, message:string}
 */
function ee_error_details(Exception $e): array
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
 * Print the failure (status + API error body) and exit unless $exit is false.
 */
function ee_error(Exception $e, string $step = 'Error', bool $exit = true): void
{
    $details = ee_error_details($e);
    ee_stderr(sprintf('%s: %d %s', $step, $details['status'], $details['message']));
    if ($exit) {
        exit(1);
    }
}

/**
 * True when the exception is a 400 whose message says the thing already exists.
 */
function ee_already_exists(Exception $e): bool
{
    $details = ee_error_details($e);
    return $details['status'] === 400 && preg_match('/exist|already/i', $details['message']) === 1;
}

/**
 * Check the X-ElasticEmail-Signature of a signed webhook request.
 *
 * Signed message: "{timestamp}\n{METHOD}\n{target}\n{body}", HMAC-SHA256 with the secret,
 * lowercase hex. $target is the path + query exactly as received (REQUEST_URI, still
 * URL-encoded), $body the raw body as received ('' for GET). The header is a comma-separated
 * list; any matching v1= entry is accepted.
 */
function ee_verify_signature(string $secret, string $timestamp, string $signatureHeader, string $method, string $target, string $body, ?int $now = null): bool
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
 * Authenticate an Elastic Email webhook notification and return its fields.
 *
 * With ELASTICEMAIL_WEBHOOK_SECRET set (a webhook created with EnableSigning), the request must
 * carry a valid signature and the event is read from the JSON body (POST, DeliveryMethod
 * PostJson) or the query string (GET). Without it, the ?token= check for unsigned webhooks
 * applies and the event comes from the query string plus form fields.
 * Field names are lower-cased (GET webhooks send e.g. "Country", PostJson "country").
 *
 * @return array{0: ?array, 1: ?array{status:int, error:string}} [event, null] or [null, error]
 */
function ee_webhook_event(string $method, string $target, string $timestamp, string $signature, string $body, array $query, array $form = []): array
{
    $secret = ee_env('ELASTICEMAIL_WEBHOOK_SECRET');
    if ($secret !== null) {
        if (!ee_verify_signature($secret, $timestamp, $signature, $method, $target, $body)) {
            return [null, ['status' => 401, 'error' => 'Invalid signature']];
        }
        if (strtoupper($method) !== 'POST') {
            return [array_change_key_case($query, CASE_LOWER), null];
        }
        $event = $body === '' ? [] : json_decode($body, true);
        if (!is_array($event)) {
            return [null, ['status' => 400, 'error' => 'Invalid JSON body']];
        }
        return [array_change_key_case($event, CASE_LOWER), null];
    }

    $expectedToken = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
    if (!hash_equals($expectedToken, (string) ($query['token'] ?? ''))) {
        return [null, ['status' => 401, 'error' => 'Invalid token']];
    }
    return [array_change_key_case(array_merge($query, $form), CASE_LOWER), null];
}

/**
 * ee_webhook_event() for plain PHP scripts: reads the request from the superglobals.
 */
function ee_webhook_event_from_globals(): array
{
    return ee_webhook_event(
        $_SERVER['REQUEST_METHOD'] ?? 'GET',
        $_SERVER['REQUEST_URI'] ?? '/',                      // path + query as received
        (string) ($_SERVER['HTTP_X_ELASTICEMAIL_TIMESTAMP'] ?? ''),
        (string) ($_SERVER['HTTP_X_ELASTICEMAIL_SIGNATURE'] ?? ''),
        (string) file_get_contents('php://input'),           // raw body, read before parsing
        $_GET,
        $_POST
    );
}
