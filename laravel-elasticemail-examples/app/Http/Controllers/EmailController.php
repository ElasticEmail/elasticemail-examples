<?php

namespace App\Http\Controllers;

use ElasticEmail\ApiException;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailMessageData;
use ElasticEmail\Model\EmailRecipient;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\Options;
use ElasticEmail\Model\TemplatePayload;
use ElasticEmail\Model\TransactionalRecipient;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * Sending examples. Blade views are rendered with view()->render() and passed as the HTML
 * body to emailsTransactionalPost. Laravel's Mail transport is not used.
 */
class EmailController extends Controller
{
    /**
     * Welcome email rendered from a Blade view.
     */
    public function sendWelcome(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'name' => 'required|string',
        ]);

        try {
            $html = view('emails.welcome', [
                'name' => $request->name,
                'actionUrl' => config('elasticemail.public_url'),
            ])->render();

            return $this->sent($this->ee->sendHtml($request->email, "Welcome, {$request->name}!", $html));
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Plain send: { email, subject, message }.
     */
    public function sendDirect(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'subject' => 'required|string',
            'message' => 'required|string',
        ]);

        try {
            return $this->sent($this->ee->sendHtml($request->email, $request->subject, "<p>{$request->message}</p>"));
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Delayed delivery. time_offset is minutes from now, max 35 days (50400).
     * Elastic Email has no cancel endpoint for a single delayed email.
     */
    public function sendScheduled(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'time_offset' => 'nullable|integer|min:1|max:50400',
        ]);

        $timeOffset = (int) $request->input('time_offset', 60);

        try {
            $result = $this->ee->sendHtml(
                $request->email,
                'Scheduled Email',
                "<p>This email was scheduled with a {$timeOffset} minute delay.</p>",
                [],
                new Options(['time_offset' => $timeOffset])
            );
            return $this->sent($result, ['time_offset' => $timeOffset]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Contact form: confirmation to the sender and a notification to the team inbox,
     * each rendered from a Blade view.
     */
    public function submitContactForm(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'email' => 'required|email',
            'message' => 'required|string',
        ]);

        $teamInbox = config('elasticemail.contact_email') ?: $this->ee->from();

        try {
            $confirmation = $this->ee->sendHtml(
                $request->email,
                'We received your message',
                view('emails.contact-confirmation', ['name' => $request->name])->render()
            );

            $notification = $this->ee->sendHtml(
                $teamInbox,
                "New message from {$request->name}",
                view('emails.contact-form', [
                    'senderName' => $request->name,
                    'senderEmail' => $request->email,
                    'message' => $request->message,
                    'submittedAt' => now()->format('F j, Y \a\t g:i A'),
                ])->render(),
                ['reply_to' => $request->email]
            );

            return response()->json([
                'success' => true,
                'confirmationMessageId' => $confirmation->getMessageId(),
                'notificationMessageId' => $notification->getMessageId(),
            ]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Bulk send: one API call, one personalized email per recipient.
     * Values from each recipient's fields replace {placeholders}. Up to 1000 recipients.
     */
    public function sendBatch(Request $request)
    {
        $request->validate([
            'recipients' => 'required|array|min:1|max:1000',
            'recipients.*.email' => 'required|email',
            'recipients.*.fields' => 'nullable|array',
        ]);

        $recipients = array_map(
            fn(array $r) => new EmailRecipient(['email' => $r['email'], 'fields' => $r['fields'] ?? []]),
            $request->input('recipients')
        );

        try {
            $result = $this->ee->emails()->emailsPost(new EmailMessageData([
                'recipients' => $recipients,
                'content' => new EmailContent([
                    'from' => $this->ee->from(),
                    'subject' => $request->input('subject', 'Hi {firstname}, your {plan} plan is ready'),
                    'body' => [new BodyPart([
                        'content_type' => 'HTML',
                        'content' => $request->input('html', '<h1>Hi {firstname}!</h1><p>Your <strong>{plan}</strong> plan is now active.</p>'),
                    ])],
                ]),
            ]));

            return $this->sent($result, ['recipients' => count($recipients)]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Uploaded file as attachment. BinaryContent is base64.
     */
    public function sendWithAttachment(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'attachment' => 'required|file|max:10240',
        ]);

        $file = $request->file('attachment');

        try {
            $result = $this->ee->sendHtml(
                $request->email,
                'Email with Attachment',
                '<p>Please find the attached file.</p>',
                [
                    'attachments' => [
                        new MessageAttachment([
                            'binary_content' => base64_encode(file_get_contents($file->getRealPath())),
                            'name' => $file->getClientOriginalName(),
                            'content_type' => $file->getMimeType(),
                        ]),
                    ],
                ]
            );
            return $this->sent($result);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Inline image. Elastic Email derives the Content-ID from the attachment name,
     * so the HTML references cid:logo.png.
     */
    public function sendWithCidAttachment(Request $request)
    {
        $request->validate(['email' => 'required|email']);

        $placeholderImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        try {
            $result = $this->ee->sendHtml(
                $request->email,
                'Email with Inline Image',
                view('emails.inline-image')->render(),
                [
                    'attachments' => [
                        new MessageAttachment([
                            'binary_content' => $placeholderImage,
                            'name' => 'logo.png',
                            'content_type' => 'image/png',
                        ]),
                    ],
                ]
            );
            return $this->sent($result);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Send with an Elastic Email template (created on first use). Merge values replace
     * {placeholders} in the template subject and body.
     */
    public function sendWithTemplate(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'template_name' => 'nullable|string',
            'merge' => 'nullable|array',
        ]);

        $templateName = $request->input('template_name', config('elasticemail.template_name'));
        $merge = $request->input('merge', ['firstname' => 'Ann', 'company' => 'Acme']);

        try {
            $this->ensureTemplate($templateName);
            $result = $this->ee->emails()->emailsTransactionalPost(new EmailTransactionalMessageData([
                'recipients' => new TransactionalRecipient(['to' => [$request->email]]),
                'content' => new EmailContent([
                    'from' => $this->ee->from(),
                    'template_name' => $templateName,
                    'merge' => $merge,
                ]),
            ]));
            return $this->sent($result, ['template' => $templateName]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    private function ensureTemplate(string $templateName): void
    {
        try {
            $this->ee->templates()->templatesByNameGet($templateName);
        } catch (ApiException $e) {
            if ($e->getCode() !== 404) {
                throw $e;
            }
            $this->ee->templates()->templatesPost(new TemplatePayload([
                'name' => $templateName,
                'subject' => 'Welcome, {firstname}!',
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => '<h1>Welcome, {firstname}!</h1><p>Thanks for joining {company}.</p>'])],
                'template_scope' => 'Personal',
            ]));
        }
    }

    /**
     * Same subject each time, but a unique X-Entity-Ref-ID header keeps Gmail from threading.
     */
    public function sendPreventThreading(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'subject' => 'required|string',
            'message' => 'required|string',
        ]);

        try {
            $result = $this->ee->sendHtml(
                $request->email,
                $request->subject,
                "<p>{$request->message}</p>",
                ['headers' => ['X-Entity-Ref-ID' => (string) Str::uuid()]]
            );
            return $this->sent($result, ['prevented_threading' => true]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
