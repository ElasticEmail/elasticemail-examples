<?php
/**
 * Inbound route management: create, list, delete.
 *
 * Inbound routing requires the domain's MX record to point at mx.inbound.elasticemail.com.
 * Matching emails are parsed and POSTed as form fields to HttpAddress
 * (from_email, subject, body_text, body_html, att1_name, att1_content, ...).
 * See src/inbound/handler.php for the receiving side.
 *
 * Usage: php src/inbound/manage.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\InboundRouteApi;
use ElasticEmail\Model\InboundPayload;

$inboundApi = new InboundRouteApi(new GuzzleHttp\Client(), ee_config());

$publicUrl = ee_env('PUBLIC_URL', 'http://localhost:3000');
$token = ee_env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
$domain = ee_env('SENDING_DOMAIN', 'yourdomain.com');

$routeId = null;
try {
    $route = $inboundApi->inboundroutePost(new InboundPayload([
        'name' => 'examples-inbound',
        'filter' => "*@{$domain}",
        'filter_type' => 'EmailAddress',
        'action_type' => 'NotifyViaHttp',
        'http_address' => $publicUrl . '/inbound?token=' . rawurlencode($token),
    ]));
    $routeId = $route->getPublicId();
    echo 'Inbound route created: ' . $routeId . ' ' . $route->getFilter() . ' -> ' . $route->getActionParameter() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (create route)');
}

try {
    $routes = $inboundApi->inboundrouteGet();
    echo "\nInbound routes (" . count($routes) . "):\n";
    foreach ($routes as $r) {
        printf(" - [%s] %s %s: %s=%s %s %s\n",
            $r->getSortOrder(), $r->getPublicId(), $r->getName(),
            $r->getFilterType(), $r->getFilter(), $r->getActionType(), $r->getActionParameter() ?? '');
    }
} catch (Exception $e) {
    ee_error($e, 'Error (list routes)');
}

// Delete the route we created (comment out to keep it)
if ($routeId) {
    try {
        $inboundApi->inboundrouteByIdDelete($routeId);
        echo "\nInbound route deleted: {$routeId}\n";
    } catch (Exception $e) {
        ee_error($e, 'Error (delete route)');
    }
}
