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
