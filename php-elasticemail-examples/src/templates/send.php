<?php
/**
 * Send with a template. Templates are referenced by name and created on first run.
 * Merge values replace {placeholders} in the template subject and body.
 *
 * Usage: php src/templates/send.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\EmailsApi;
use ElasticEmail\Api\TemplatesApi;
use ElasticEmail\ApiException;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\TemplatePayload;
use ElasticEmail\Model\TransactionalRecipient;

$emailsApi = new EmailsApi(new GuzzleHttp\Client(), ee_config());
$templatesApi = new TemplatesApi(new GuzzleHttp\Client(), ee_config());

$templateName = ee_env('ELASTICEMAIL_TEMPLATE_NAME', 'welcome-example');

function ensureTemplate(TemplatesApi $templatesApi, string $templateName): void
{
    try {
        $templatesApi->templatesByNameGet($templateName);
        echo "Template \"{$templateName}\" already exists.\n";
    } catch (ApiException $e) {
        if ($e->getCode() !== 404) {
            throw $e;
        }
        $templatesApi->templatesPost(new TemplatePayload([
            'name' => $templateName,
            'subject' => 'Welcome, {firstname}!',
            'body' => [
                new BodyPart([
                    'content_type' => 'HTML',
                    'content' => '<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>',
                ]),
            ],
            'template_scope' => 'Personal',
        ]));
        echo "Template \"{$templateName}\" created.\n";
    }
}

try {
    ensureTemplate($templatesApi, $templateName);

    $result = $emailsApi->emailsTransactionalPost(new EmailTransactionalMessageData([
        'recipients' => new TransactionalRecipient(['to' => [ee_to()]]),
        'content' => new EmailContent([
            'from' => ee_from(),
            'template_name' => $templateName,
            'merge' => ['firstname' => 'Ann', 'company' => 'Acme'],
        ]),
    ]));

    echo "Template email sent successfully!\n";
    echo 'Transaction ID: ' . $result->getTransactionId() . "\n";
    echo 'Message ID: ' . $result->getMessageId() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error');
}
