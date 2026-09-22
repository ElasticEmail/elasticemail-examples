<?php

namespace App\Http\Controllers;

use ElasticEmail\Model\MessageAttachment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Inbound email pushed by an inbound route with ActionType "NotifyViaHttp".
 *
 * Setup: point the domain's MX record at mx.inbound.elasticemail.com and create a route
 * whose HttpAddress is PUBLIC_URL/api/inbound?token=ELASTICEMAIL_WEBHOOK_TOKEN.
 * Elastic Email POSTs the parsed message as form fields: from_email, from_name, env_from,
 * env_to_list, to_list, header_list, subject, body_text, body_html,
 * att1_name/att1_content (base64), att2_name/att2_content, ...
 */
class InboundController extends Controller
{
    public function handle(Request $request)
    {
        if (!$this->ee->tokenOk($request->query('token'))) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        $mail = $request->post();
        $attachments = [];
        foreach ($mail as $key => $value) {
            if (preg_match('/^att\d+_name$/', $key)) {
                $content = $mail[str_replace('_name', '_content', $key)] ?? null;
                if ($content) {
                    $attachments[] = new MessageAttachment(['name' => $value, 'binary_content' => $content]);
                }
            }
        }

        Log::info('Inbound email received', [
            'from' => $this->sanitize($mail['from_email'] ?? ''),
            'subject' => $this->sanitize($mail['subject'] ?? ''),
            'attachments' => count($attachments),
        ]);

        $body = $mail['body_html'] ?? '';
        if ($body === '') {
            $body = '<pre>' . e($mail['body_text'] ?? '') . '</pre>';
        }

        $forwardTo = config('elasticemail.contact_email') ?: $this->ee->from();

        try {
            $result = $this->ee->sendHtml(
                $forwardTo,
                'Fwd: ' . ($mail['subject'] ?? '(no subject)'),
                view('emails.inbound-forwarded', [
                    'originalFrom' => $mail['from_email'] ?? '',
                    'originalTo' => $mail['to_list'] ?? '',
                    'originalSubject' => $mail['subject'] ?? '',
                    'originalDate' => now()->toRfc2822String(),
                    'body' => $body,
                ])->render(),
                [
                    'reply_to' => $mail['from_email'] ?? null,
                    'attachments' => $attachments,
                ]
            );

            return response()->json(['received' => true, 'forwardedTo' => $forwardTo, 'forwardedMessageId' => $result->getMessageId()]);
        } catch (\Exception $e) {
            Log::error('Inbound forward failed', ['error' => $e->getMessage()]);
            return $this->fail($e);
        }
    }
}
