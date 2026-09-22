<?php
/**
 * Double opt-in: subscribe.
 *
 * Stores the contact with status "Transactional" (receives the confirmation, excluded from
 * campaigns) and sends a confirmation link carrying an HMAC of the email. The confirm
 * endpoint (double-optin/confirm.php or the Slim app) validates the HMAC and adds the
 * contact to the list.
 *
 * Usage: php src/double-optin/subscribe.php user@example.com "John Doe"
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\ContactsApi;
use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\ContactPayload;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\TransactionalRecipient;

$email = $argv[1] ?? null;
$name = $argv[2] ?? '';

if (!$email) {
    fwrite(STDERR, "Usage: php src/double-optin/subscribe.php <email> [\"Name\"]\n");
    exit(1);
}

$contactsApi = new ContactsApi(new GuzzleHttp\Client(), ee_config());
$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());

$publicUrl = ee_env('PUBLIC_URL', 'http://localhost:3000');
$secret = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');

$confirmToken = hash_hmac('sha256', $email, $secret);
$confirmUrl = $publicUrl . '/double-optin/confirm?email=' . rawurlencode($email) . '&token=' . $confirmToken;

$nameParts = $name === '' ? [] : explode(' ', $name);
$firstName = $nameParts[0] ?? '';
$lastName = implode(' ', array_slice($nameParts, 1));
$greeting = $name !== '' ? "Welcome, {$name}!" : 'Welcome!';

$html = <<<HTML
<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{$greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{$confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>
HTML;

try {
    // Step 1: store the contact without adding it to the marketing list.
    $contactsApi->contactsPost([
        new ContactPayload([
            'email' => $email,
            'first_name' => $firstName,
            'last_name' => $lastName,
            'status' => 'Transactional',
        ]),
    ]);
    echo "Contact stored (unconfirmed): {$email}\n";

    // Step 2: send the confirmation email
    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [$email]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'subject' => 'Confirm your subscription',
            'body' => [
                new BodyPart(['content_type' => 'HTML', 'content' => $html]),
                new BodyPart(['content_type' => 'PlainText', 'content' => "{$greeting}\n\nConfirm your subscription: {$confirmUrl}"]),
            ],
        ]),
    ]));

    echo 'Confirmation email sent. Message ID: ' . $result->getMessageId() . "\n";
    echo "Confirm URL: {$confirmUrl}\n";
    echo "\nWhen the link is opened, GET /double-optin/confirm (src/double-optin/confirm.php or src/slim_app.php) adds the contact to the list.\n";
} catch (Exception $e) {
    ee_error($e, 'Error');
}
