<?php
/**
 * Slim application with Elastic Email.
 *
 * Usage:
 *   php -S localhost:8080 src/slim_app.php
 *
 * Endpoints:
 *   GET      /health
 *   POST     /send                      { to, subject, message }
 *   GET|POST /webhook?token=            Elastic Email event notifications
 *   POST     /inbound?token=            inbound email pushed by an inbound route
 *   POST     /double-optin/subscribe    { email, name }
 *   GET      /double-optin/confirm?email=&token=
 *   POST     /double-optin/webhook?token=
 */

require_once __DIR__ . '/bootstrap.php';

use ElasticEmail\Api\ContactsApi;
use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Api\ListsApi;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\ContactPayload;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailsPayload;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\TransactionalRecipient;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;

$app = AppFactory::create();
$app->addBodyParsingMiddleware(); // JSON and form-encoded bodies
$app->addErrorMiddleware(true, true, true);

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());
$contactsApi = new ContactsApi(new GuzzleHttp\Client(), ee_config());
$listsApi = new ListsApi(new GuzzleHttp\Client(), ee_config());

$from = ee_from();
$contactEmail = ee_env('CONTACT_EMAIL', $from);
$listName = ee_env('ELASTICEMAIL_LIST_NAME', 'Newsletter');
$publicUrl = ee_env('PUBLIC_URL', 'http://localhost:3000');
$secret = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
$confirmRedirectUrl = ee_env('CONFIRM_REDIRECT_URL');

$json = function (Response $response, array $data, int $status = 200): Response {
    $response->getBody()->write(json_encode($data));
    return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
};

$apiError = fn(Response $response, Exception $e): Response => $json($response, ['error' => ee_error_details($e)['message']], ee_error_details($e)['status']);

$sanitize = fn($value): string => str_replace(["\r", "\n"], '', (string) ($value ?? ''));

/** Constant-time check of the shared secret carried in ?token= */
$tokenOk = fn(Request $request): bool => hash_equals($secret, (string) ($request->getQueryParams()['token'] ?? ''));

$hmac = fn(string $value): string => hash_hmac('sha256', $value, $secret);

$app->get('/health', fn(Request $request, Response $response) => $json($response, ['status' => 'ok']));

$app->post('/send', function (Request $request, Response $response) use ($emailsApi, $from, $json, $apiError) {
    $body = (array) ($request->getParsedBody() ?? []);
    $to = $body['to'] ?? null;
    $subject = $body['subject'] ?? null;
    $message = $body['message'] ?? null;

    if (!$to || !$subject || !$message) {
        return $json($response, ['error' => 'Missing required fields: to, subject, message'], 400);
    }

    try {
        $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
            'recipients' => new TransactionalRecipient(['to' => [$to]]),
            'content' => new EmailContent([
                'from' => $from,
                'subject' => $subject,
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => "<p>{$message}</p>"])],
            ]),
        ]));

        return $json($response, [
            'success' => true,
            'transactionId' => $result->getTransactionId(),
            'messageId' => $result->getMessageId(),
        ]);
    } catch (Exception $e) {
        return $apiError($response, $e);
    }
});

// Elastic Email event notifications. Parameters arrive in the query string (GET) or as
// form fields (POST): transaction, messageid, to, from, subject, date, status, category,
// channel, target (clicked URL), IP, Useragent, Country, City.
// Elastic Email sends a GET to validate the URL when the webhook is saved.
$app->map(['GET', 'POST'], '/webhook', function (Request $request, Response $response) use ($json, $tokenOk, $sanitize) {
    if (!$tokenOk($request)) {
        return $json($response, ['error' => 'Invalid token'], 401);
    }

    $event = array_merge($request->getQueryParams(), (array) ($request->getParsedBody() ?? []));
    $status = $sanitize($event['status'] ?? '');

    if ($status === '') {
        return $json($response, ['ok' => true]);
    }

    error_log(sprintf('Webhook event: %s to: %s transaction: %s', $status, $sanitize($event['to'] ?? ''), $sanitize($event['transaction'] ?? '')));

    switch ($status) {
        case 'Sent':
            error_log('Email sent, message id: ' . $sanitize($event['messageid'] ?? ''));
            break;
        case 'Opened':
            error_log('Email opened from ' . $sanitize($event['Country'] ?? '') . ' ' . $sanitize($event['City'] ?? ''));
            break;
        case 'Clicked':
            error_log('Link clicked: ' . $sanitize($event['target'] ?? ''));
            break;
        case 'Error':
            error_log('Bounce/error, category: ' . $sanitize($event['category'] ?? ''));
            break;
        case 'AbuseReport':
            error_log('Complaint received');
            break;
        case 'Unsubscribed':
            error_log('Recipient unsubscribed');
            break;
    }

    return $json($response, ['received' => true, 'status' => $status]);
});

// Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
// Form fields: from_email, from_name, env_from, env_to_list, to_list, header_list,
// subject, body_text, body_html, att1_name/att1_content (base64), att2_name/att2_content, ...
$app->post('/inbound', function (Request $request, Response $response) use ($emailsApi, $from, $contactEmail, $json, $apiError, $tokenOk, $sanitize) {
    if (!$tokenOk($request)) {
        return $json($response, ['error' => 'Invalid token'], 401);
    }

    $mail = (array) ($request->getParsedBody() ?? []);
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

    // Forward a copy to the team inbox
    try {
        $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
            'recipients' => new TransactionalRecipient(['to' => [$contactEmail]]),
            'content' => new EmailContent([
                'from' => $from,
                'reply_to' => $mail['from_email'] ?? null,
                'subject' => 'Fwd: ' . ($mail['subject'] ?? '(no subject)'),
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $bodyHtml])],
                'attachments' => $attachments,
            ]),
        ]));

        return $json($response, ['received' => true, 'forwardedMessageId' => $result->getMessageId()]);
    } catch (Exception $e) {
        return $apiError($response, $e);
    }
});

$app->post('/double-optin/subscribe', function (Request $request, Response $response) use ($emailsApi, $contactsApi, $from, $publicUrl, $json, $apiError, $hmac) {
    $body = (array) ($request->getParsedBody() ?? []);
    $email = $body['email'] ?? null;
    $name = (string) ($body['name'] ?? '');

    if (!$email) {
        return $json($response, ['error' => 'Missing required field: email'], 400);
    }

    $confirmUrl = $publicUrl . '/double-optin/confirm?email=' . rawurlencode($email) . '&token=' . $hmac($email);
    $greeting = $name !== '' ? "Welcome, {$name}!" : 'Welcome!';
    $html = <<<HTML
<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{$greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{$confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>
HTML;

    try {
        // Stored as Transactional so it receives the confirmation but no campaigns yet
        $contactsApi->contactsPost([
            new ContactPayload([
                'email' => $email,
                'first_name' => explode(' ', $name)[0] ?? '',
                'status' => 'Transactional',
            ]),
        ]);

        $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
            'recipients' => new TransactionalRecipient(['to' => [$email]]),
            'content' => new EmailContent([
                'from' => $from,
                'subject' => 'Confirm your subscription',
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $html])],
            ]),
        ]));

        return $json($response, ['success' => true, 'message' => 'Confirmation email sent', 'messageId' => $result->getMessageId()]);
    } catch (Exception $e) {
        return $apiError($response, $e);
    }
});

$app->get('/double-optin/confirm', function (Request $request, Response $response) use ($listsApi, $listName, $confirmRedirectUrl, $json, $apiError, $hmac) {
    $query = $request->getQueryParams();
    $email = (string) ($query['email'] ?? '');
    $token = (string) ($query['token'] ?? '');

    if ($email === '' || !hash_equals($hmac($email), $token)) {
        return $json($response, ['error' => 'Invalid confirmation link'], 400);
    }

    try {
        $listsApi->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$email]]));
        if ($confirmRedirectUrl) {
            return $response->withStatus(302)->withHeader('Location', $confirmRedirectUrl);
        }
        return $json($response, ['confirmed' => true, 'email' => $email, 'list' => $listName]);
    } catch (Exception $e) {
        return $apiError($response, $e);
    }
});

// Click-tracking based confirmation: create a webhook for Clicked events pointing here.
$app->post('/double-optin/webhook', function (Request $request, Response $response) use ($listsApi, $listName, $json, $apiError, $tokenOk, $sanitize) {
    if (!$tokenOk($request)) {
        return $json($response, ['error' => 'Invalid token'], 401);
    }

    $event = array_merge($request->getQueryParams(), (array) ($request->getParsedBody() ?? []));
    $status = $sanitize($event['status'] ?? '');
    $target = (string) ($event['target'] ?? '');
    $recipient = $sanitize($event['to'] ?? '');

    if ($status !== 'Clicked' || !str_contains($target, '/double-optin/confirm')) {
        return $json($response, ['received' => true, 'status' => $status, 'message' => 'Event ignored']);
    }

    try {
        $listsApi->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$recipient]]));
        return $json($response, ['received' => true, 'confirmed' => true, 'email' => $recipient]);
    } catch (Exception $e) {
        return $apiError($response, $e);
    }
});

$app->run();
