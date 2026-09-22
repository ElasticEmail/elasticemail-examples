<?php

namespace App\Http\Controllers;

use ElasticEmail\Model\ContactPayload;
use ElasticEmail\Model\EmailsPayload;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * Double opt-in.
 * 1. subscribe: contact stored with status "Transactional" (not on the list), confirmation email sent
 *    with a link carrying an HMAC of the address
 * 2. confirm: HMAC validated, contact added to ELASTICEMAIL_LIST_NAME
 * 3. webhook: alternative confirm path driven by Elastic Email click tracking
 */
class DoubleOptinController extends Controller
{
    public function subscribe(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'name' => 'nullable|string|max:255',
        ]);

        $email = $request->email;
        $name = (string) $request->input('name', '');
        $confirmUrl = config('elasticemail.public_url') . '/api/double-optin/confirm?email=' . rawurlencode($email) . '&token=' . $this->ee->hmac($email);

        try {
            $this->ee->contacts()->contactsPost([
                new ContactPayload([
                    'email' => $email,
                    'first_name' => explode(' ', $name)[0] ?? '',
                    'status' => 'Transactional',
                ]),
            ]);

            $result = $this->ee->sendHtml(
                $email,
                'Confirm your subscription',
                view('emails.double-optin-confirm', [
                    'welcomeText' => $name !== '' ? "Welcome, {$name}!" : 'Welcome!',
                    'confirmUrl' => $confirmUrl,
                ])->render()
            );

            return response()->json([
                'success' => true,
                'message' => 'Confirmation email sent',
                'messageId' => $result->getMessageId(),
            ]);
        } catch (\Exception $e) {
            Log::error('Double opt-in subscribe failed', ['error' => $e->getMessage()]);
            return $this->fail($e);
        }
    }

    public function confirm(Request $request)
    {
        $email = (string) $request->query('email', '');
        $token = (string) $request->query('token', '');
        $listName = config('elasticemail.list_name');

        if ($email === '' || !hash_equals($this->ee->hmac($email), $token)) {
            return response()->json(['error' => 'Invalid confirmation link'], 400);
        }

        try {
            $this->ee->lists()->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$email]]));
            Log::info("Subscription confirmed: {$email} -> {$listName}");

            if ($redirect = config('elasticemail.confirm_redirect_url')) {
                return redirect()->away($redirect);
            }
            return response()->json(['confirmed' => true, 'email' => $email, 'list' => $listName]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Click-tracking based confirm. Register a webhook for Clicked events pointing here.
     * On status=Clicked with the confirm URL in "target", the recipient is added to the list.
     */
    public function webhook(Request $request)
    {
        if (!$this->ee->tokenOk($request->query('token'))) {
            return response()->json(['error' => 'Invalid token'], 401);
        }

        // Elastic Email validates the URL with a GET when the webhook is saved
        if ($request->isMethod('GET') && !$request->has('status')) {
            return response()->json(['ok' => true]);
        }

        $event = array_merge($request->query(), $request->post());
        $status = $this->sanitize($event['status'] ?? '');
        $target = (string) ($event['target'] ?? '');
        $recipient = $this->sanitize($event['to'] ?? '');
        $listName = config('elasticemail.list_name');

        if ($status !== 'Clicked' || !str_contains($target, '/double-optin/confirm')) {
            return response()->json(['received' => true, 'status' => $status, 'message' => 'Event ignored']);
        }

        try {
            $this->ee->lists()->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$recipient]]));
            Log::info("Subscription confirmed via click: {$recipient}");
            return response()->json(['received' => true, 'confirmed' => true, 'email' => $recipient, 'list' => $listName]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
