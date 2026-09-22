<?php

use App\Controller\EmailController;
use App\Controller\HealthController;
use App\Controller\WebhookController;
use Symfony\Component\Routing\Loader\Configurator\RoutingConfigurator;

return function (RoutingConfigurator $routes): void {
    $routes->add('health', '/health')
        ->controller([HealthController::class, 'index'])
        ->methods(['GET']);

    $routes->add('send', '/send')
        ->controller([EmailController::class, 'send'])
        ->methods(['POST']);

    $routes->add('send_prevent_threading', '/send-prevent-threading')
        ->controller([EmailController::class, 'sendPreventThreading'])
        ->methods(['POST']);

    $routes->add('send_batch', '/send-batch')
        ->controller([EmailController::class, 'sendBatch'])
        ->methods(['POST']);

    $routes->add('send_attachment', '/send-attachment')
        ->controller([EmailController::class, 'sendAttachment'])
        ->methods(['POST']);

    $routes->add('send_cid', '/send-cid')
        ->controller([EmailController::class, 'sendCid'])
        ->methods(['POST']);

    $routes->add('send_scheduled', '/send-scheduled')
        ->controller([EmailController::class, 'sendScheduled'])
        ->methods(['POST']);

    $routes->add('send_template', '/send-template')
        ->controller([EmailController::class, 'sendTemplate'])
        ->methods(['POST']);

    $routes->add('list_domains', '/domains')
        ->controller([EmailController::class, 'listDomains'])
        ->methods(['GET']);

    $routes->add('create_domain', '/domains')
        ->controller([EmailController::class, 'createDomain'])
        ->methods(['POST']);

    $routes->add('list_contacts', '/contacts')
        ->controller([EmailController::class, 'listContacts'])
        ->methods(['GET']);

    $routes->add('create_contact', '/contacts')
        ->controller([EmailController::class, 'createContact'])
        ->methods(['POST']);

    $routes->add('webhook', '/webhook')
        ->controller([WebhookController::class, 'handle'])
        ->methods(['GET', 'POST']);

    $routes->add('inbound', '/inbound')
        ->controller([WebhookController::class, 'inbound'])
        ->methods(['POST']);

    $routes->add('double_optin_subscribe', '/double-optin/subscribe')
        ->controller([EmailController::class, 'doubleOptinSubscribe'])
        ->methods(['POST']);

    $routes->add('double_optin_confirm', '/double-optin/confirm')
        ->controller([EmailController::class, 'doubleOptinConfirm'])
        ->methods(['GET']);

    $routes->add('double_optin_webhook', '/double-optin/webhook')
        ->controller([WebhookController::class, 'doubleOptin'])
        ->methods(['POST']);
};
