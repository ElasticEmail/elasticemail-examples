<?php

/**
 * Elastic Email configuration. Values come from .env (see .env.example).
 */

return [
    // API key from https://app.elasticemail.com/marketing/settings/new/manage-api
    'api_key' => env('ELASTICEMAIL_API_KEY'),

    // Verified sender, e.g. "Acme <hello@yourdomain.com>"
    'from' => env('EMAIL_FROM', 'Acme <hello@yourdomain.com>'),

    // Team inbox used by the inbound forwarder
    'contact_email' => env('CONTACT_EMAIL'),

    // Signing secret returned once when the webhook is created with EnableSigning; leave empty
    // to use ELASTICEMAIL_WEBHOOK_TOKEN. When set, the webhook routes require a valid signature.
    'webhook_secret' => env('ELASTICEMAIL_WEBHOOK_SECRET'),

    // Shared secret appended to inbound URLs (and to unsigned webhook URLs) as ?token=...
    'webhook_token' => env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me'),

    // Contact list used by the contacts and double opt-in endpoints
    'list_name' => env('ELASTICEMAIL_LIST_NAME', 'Newsletter'),

    // Template created on first use by /api/send/template
    'template_name' => env('ELASTICEMAIL_TEMPLATE_NAME', 'welcome-example'),

    // Public base URL of this app, used to build confirm links
    'public_url' => env('PUBLIC_URL', 'http://localhost:8000'),

    // Domain used by the domains endpoints when none is given
    'sending_domain' => env('SENDING_DOMAIN'),

    // Optional redirect after double opt-in confirmation
    'confirm_redirect_url' => env('CONFIRM_REDIRECT_URL'),
];
