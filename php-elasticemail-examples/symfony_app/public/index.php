<?php

use App\Kernel;

require_once dirname(__DIR__) . '/vendor/autoload_runtime.php';

// Environment variables live in the parent folder's .env (shared with the standalone examples).
Dotenv\Dotenv::createImmutable(dirname(__DIR__, 2))->safeLoad();

return function (array $context) {
    return new Kernel($context['APP_ENV'] ?? 'dev', (bool) ($context['APP_DEBUG'] ?? true));
};
