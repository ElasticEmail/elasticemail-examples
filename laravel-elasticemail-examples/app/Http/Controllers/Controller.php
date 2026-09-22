<?php

namespace App\Http\Controllers;

use App\Services\ElasticEmail;
use Illuminate\Http\JsonResponse;

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

    protected function sanitize($value): string
    {
        return str_replace(["\r", "\n"], '', (string) ($value ?? ''));
    }
}
