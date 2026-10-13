<?php

namespace App\Http\Controllers;

use App\Services\ElasticEmail;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Shared helpers for the example controllers.
 */
abstract class Controller
{
    public function __construct(protected ElasticEmail $ee)
    {
    }

    protected function fail(\Exception $e): JsonResponse
    {
        $details = $this->ee->errorDetails($e);
        return response()->json(['error' => $details['message']], $details['status']);
    }

    protected function sent($result, array $extra = []): JsonResponse
    {
        return response()->json(array_merge([
            'success' => true,
            'transactionId' => $result->getTransactionId(),
            'messageId' => $result->getMessageId(),
        ], $extra));
    }

    /**
     * Authenticate an Elastic Email webhook notification and return [event, null] or [null, error response].
     *
     * With ELASTICEMAIL_WEBHOOK_SECRET set (a webhook created with EnableSigning), the request must
     * carry a valid signature and the event is the JSON body (POST, DeliveryMethod PostJson) or the
     * query string (GET). Without it, the ?token= check for unsigned webhooks applies.
     * Field names are lower-cased (GET webhooks send e.g. "Country", PostJson "country").
     */
    protected function webhookEvent(Request $request): array
    {
        $secret = (string) config('elasticemail.webhook_secret');
        if ($secret !== '') {
            $body = $request->getContent(); // raw body, read before any parsing
            $valid = $this->ee->verifySignature(
                $secret,
                (string) $request->header('X-ElasticEmail-Timestamp', ''),
                (string) $request->header('X-ElasticEmail-Signature', ''),
                $request->getMethod(),
                $request->getRequestUri(), // path + query as received (REQUEST_URI)
                $body
            );
            if (!$valid) {
                return [null, response()->json(['error' => 'Invalid signature'], 401)];
            }
            if (!$request->isMethod('POST')) {
                return [array_change_key_case($request->query(), CASE_LOWER), null];
            }
            $event = $body === '' ? [] : json_decode($body, true);
            if (!is_array($event)) {
                return [null, response()->json(['error' => 'Invalid JSON body'], 400)];
            }
            return [array_change_key_case($event, CASE_LOWER), null];
        }

        if (!$this->ee->tokenOk($request->query('token'))) {
            return [null, response()->json(['error' => 'Invalid token'], 401)];
        }
        return [array_change_key_case(array_merge($request->query(), $request->post()), CASE_LOWER), null];
    }

    protected function sanitize($value): string
    {
        return str_replace(["\r", "\n"], '', (string) ($value ?? ''));
    }
}
