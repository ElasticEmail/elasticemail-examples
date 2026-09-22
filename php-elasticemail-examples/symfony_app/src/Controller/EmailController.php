<?php

namespace App\Controller;

use App\Service\ElasticEmail;
use ElasticEmail\ApiException;
use ElasticEmail\Model\BodyPart;
use ElasticEmail\Model\ContactPayload;
use ElasticEmail\Model\DomainPayload;
use ElasticEmail\Model\EmailContent;
use ElasticEmail\Model\EmailMessageData;
use ElasticEmail\Model\EmailRecipient;
use ElasticEmail\Model\EmailsPayload;
use ElasticEmail\Model\EmailTransactionalMessageData;
use ElasticEmail\Model\MessageAttachment;
use ElasticEmail\Model\Options;
use ElasticEmail\Model\TemplatePayload;
use ElasticEmail\Model\TransactionalRecipient;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

class EmailController
{
    public function __construct(private ElasticEmail $ee)
    {
    }

    private function body(Request $request): array
    {
        $decoded = json_decode($request->getContent(), true);
        return is_array($decoded) ? $decoded : $request->request->all();
    }

    private function fail(\Exception $e): JsonResponse
    {
        $details = $this->ee->errorDetails($e);
        return new JsonResponse(['error' => $details['message']], $details['status']);
    }

    private function sent($result): JsonResponse
    {
        return new JsonResponse([
            'success' => true,
            'transactionId' => $result->getTransactionId(),
            'messageId' => $result->getMessageId(),
        ]);
    }

    private function transactional(string $to, EmailContent $content, ?Options $options = null): JsonResponse
    {
        $data = ['recipients' => new TransactionalRecipient(['to' => [$to]]), 'content' => $content];
        if ($options) {
            $data['options'] = $options;
        }
        return $this->sent($this->ee->emails()->emailsTransactionalPost(new EmailTransactionalMessageData($data)));
    }

    public function send(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $to = $body['to'] ?? null;
        $subject = $body['subject'] ?? null;
        $message = $body['message'] ?? null;

        if (!$to || !$subject || !$message) {
            return new JsonResponse(['error' => 'Missing required fields: to, subject, message'], 400);
        }

        try {
            return $this->transactional($to, new EmailContent([
                'from' => $this->ee->from(),
                'subject' => $subject,
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => "<p>{$message}</p>"])],
            ]));
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function sendPreventThreading(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $to = $body['to'] ?? null;
        $subject = $body['subject'] ?? 'Your Daily Report';
        $message = $body['message'] ?? 'This email will not be threaded in Gmail.';

        if (!$to) {
            return new JsonResponse(['error' => 'Missing required field: to'], 400);
        }

        try {
            $response = $this->transactional($to, new EmailContent([
                'from' => $this->ee->from(),
                'subject' => $subject,
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => "<p>{$message}</p>"])],
                // A unique X-Entity-Ref-ID per email stops Gmail from grouping same-subject emails
                'headers' => ['X-Entity-Ref-ID' => bin2hex(random_bytes(16))],
            ]));
            $payload = json_decode($response->getContent(), true);
            $payload['preventedThreading'] = true;
            return new JsonResponse($payload);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Bulk send: one personalized email per recipient, merge fields as {firstname}.
     */
    public function sendBatch(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $to = $body['to'] ?? null;
        $contactEmail = $body['contactEmail'] ?? $this->ee->env('CONTACT_EMAIL', $this->ee->from());

        if (!$to) {
            return new JsonResponse(['error' => 'Missing required field: to'], 400);
        }

        try {
            $result = $this->ee->emails()->emailsPost(new EmailMessageData([
                'recipients' => [
                    new EmailRecipient(['email' => $to, 'fields' => ['firstname' => 'Ann']]),
                    new EmailRecipient(['email' => $contactEmail, 'fields' => ['firstname' => 'Team']]),
                ],
                'content' => new EmailContent([
                    'from' => $this->ee->from(),
                    'subject' => 'Hi {firstname}, we received your message',
                    'body' => [new BodyPart(['content_type' => 'HTML', 'content' => '<h1>Hi {firstname}!</h1><p>We will get back to you soon.</p>'])],
                ]),
            ]));

            return new JsonResponse(['success' => true, 'transactionId' => $result->getTransactionId(), 'messageId' => $result->getMessageId()]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function sendAttachment(Request $request): JsonResponse
    {
        $to = $this->body($request)['to'] ?? null;
        if (!$to) {
            return new JsonResponse(['error' => 'Missing required field: to'], 400);
        }

        $fileContent = "Sample Attachment\n==================\n\nThis file was attached to your email.\nSent at: " . date('c') . "\n";

        try {
            return $this->transactional($to, new EmailContent([
                'from' => $this->ee->from(),
                'subject' => 'Email with Attachment',
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => '<h1>Your attachment is ready</h1><p>Please find the sample file attached.</p>'])],
                'attachments' => [
                    new MessageAttachment([
                        'binary_content' => base64_encode($fileContent),
                        'name' => 'sample.txt',
                        'content_type' => 'text/plain',
                    ]),
                ],
            ]));
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function sendCid(Request $request): JsonResponse
    {
        $to = $this->body($request)['to'] ?? null;
        if (!$to) {
            return new JsonResponse(['error' => 'Missing required field: to'], 400);
        }

        $placeholderImage = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

        try {
            // Elastic Email derives the Content-ID from the attachment name: cid:logo.png
            return $this->transactional($to, new EmailContent([
                'from' => $this->ee->from(),
                'subject' => 'Email with Inline Image',
                'body' => [new BodyPart([
                    'content_type' => 'HTML',
                    'content' => '<div style="text-align:center;padding:20px;"><img src="cid:logo.png" alt="Logo" width="100" height="100" /><h1>Inline Image Example</h1><p>The image above is embedded using CID.</p></div>',
                ])],
                'attachments' => [
                    new MessageAttachment([
                        'binary_content' => $placeholderImage,
                        'name' => 'logo.png',
                        'content_type' => 'image/png',
                    ]),
                ],
            ]));
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * Delayed delivery. timeOffset is minutes from now, max 35 days (50400).
     */
    public function sendScheduled(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $to = $body['to'] ?? null;
        $subject = $body['subject'] ?? null;
        $message = $body['message'] ?? null;
        $timeOffset = (int) ($body['timeOffset'] ?? 60);

        if (!$to || !$subject || !$message) {
            return new JsonResponse(['error' => 'Missing required fields: to, subject, message'], 400);
        }

        try {
            $response = $this->transactional($to, new EmailContent([
                'from' => $this->ee->from(),
                'subject' => $subject,
                'body' => [new BodyPart(['content_type' => 'HTML', 'content' => "<p>{$message}</p>"])],
            ]), new Options(['time_offset' => $timeOffset]));
            $payload = json_decode($response->getContent(), true);
            $payload['timeOffset'] = $timeOffset;
            return new JsonResponse($payload);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function sendTemplate(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $to = $body['to'] ?? null;
        $templateName = $body['templateName'] ?? $this->ee->env('ELASTICEMAIL_TEMPLATE_NAME', 'welcome-example');
        $merge = is_array($body['merge'] ?? null) ? $body['merge'] : ['firstname' => 'Ann', 'company' => 'Acme'];

        if (!$to) {
            return new JsonResponse(['error' => 'Missing required field: to'], 400);
        }

        try {
            $this->ensureTemplate($templateName);
            return $this->transactional($to, new EmailContent([
                'from' => $this->ee->from(),
                'template_name' => $templateName,
                'merge' => $merge,
            ]));
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

    public function listDomains(): JsonResponse
    {
        try {
            $domains = array_map(fn($d) => [
                'domain' => $d->getDomain(),
                'spf' => (bool) $d->getSpf(),
                'dkim' => (bool) $d->getDkim(),
                'mx' => (bool) $d->getMx(),
                'dmarc' => (bool) $d->getDmarc(),
                'trackingStatus' => $d->getTrackingStatus(),
                'default' => (bool) $d->getDefaultDomain(),
            ], $this->ee->domains()->domainsGet());
            return new JsonResponse(['domains' => $domains]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function createDomain(Request $request): JsonResponse
    {
        $domain = $this->body($request)['domain'] ?? null;
        if (!$domain) {
            return new JsonResponse(['error' => 'Missing required field: domain'], 400);
        }

        try {
            $this->ee->domains()->domainsPost(new DomainPayload(['domain' => $domain]));
            $detail = $this->ee->domains()->domainsByDomainGet($domain);
            return new JsonResponse([
                'success' => true,
                'domain' => $detail->getDomain(),
                'spf' => (bool) $detail->getSpf(),
                'dkim' => (bool) $detail->getDkim(),
                'dkimRecord' => $detail->getDkimRecord(),
                'message' => 'Add the DNS records shown in the Elastic Email dashboard to verify the domain',
            ]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function listContacts(Request $request): JsonResponse
    {
        $listName = $request->query->get('list', $this->ee->env('ELASTICEMAIL_LIST_NAME', 'Newsletter'));

        try {
            $contacts = array_map(fn($c) => [
                'email' => $c->getEmail(),
                'firstName' => $c->getFirstName(),
                'lastName' => $c->getLastName(),
                'status' => $c->getStatus(),
            ], $this->ee->lists()->listsByListnameContactsGet($listName, 100, 0));
            return new JsonResponse(['list' => $listName, 'contacts' => $contacts, 'total' => count($contacts)]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function createContact(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $email = $body['email'] ?? null;
        $listName = $body['list'] ?? $this->ee->env('ELASTICEMAIL_LIST_NAME', 'Newsletter');

        if (!$email) {
            return new JsonResponse(['error' => 'Missing required field: email'], 400);
        }

        try {
            $created = $this->ee->contacts()->contactsPost([
                new ContactPayload([
                    'email' => $email,
                    'first_name' => $body['firstName'] ?? '',
                    'last_name' => $body['lastName'] ?? '',
                    'status' => 'Active',
                ]),
            ], [$listName]);
            return new JsonResponse(['success' => true, 'email' => $created[0]->getEmail(), 'status' => $created[0]->getStatus(), 'list' => $listName], 201);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function doubleOptinSubscribe(Request $request): JsonResponse
    {
        $body = $this->body($request);
        $email = $body['email'] ?? null;
        $name = (string) ($body['name'] ?? '');

        if (!$email) {
            return new JsonResponse(['error' => 'Missing required field: email'], 400);
        }

        $publicUrl = $this->ee->env('PUBLIC_URL', 'http://localhost:8081');
        $secret = $this->ee->env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
        $confirmUrl = $publicUrl . '/double-optin/confirm?email=' . rawurlencode($email) . '&token=' . hash_hmac('sha256', $email, $secret);
        $greeting = $name !== '' ? "Welcome, {$name}!" : 'Welcome!';
        $html = <<<HTML
<div style="text-align: center; padding: 40px 20px; font-family: Arial, sans-serif;">
  <h1>{$greeting}</h1>
  <p>Please confirm your subscription to our newsletter.</p>
  <a href="{$confirmUrl}" style="background-color: #18181b; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: bold; display: inline-block;">Confirm Subscription</a>
</div>
HTML;

        try {
            // Stored as Transactional: receives the confirmation, excluded from campaigns
            $this->ee->contacts()->contactsPost([
                new ContactPayload([
                    'email' => $email,
                    'first_name' => explode(' ', $name)[0] ?? '',
                    'status' => 'Transactional',
                ]),
            ]);

            $result = $this->ee->emails()->emailsTransactionalPost(new EmailTransactionalMessageData([
                'recipients' => new TransactionalRecipient(['to' => [$email]]),
                'content' => new EmailContent([
                    'from' => $this->ee->from(),
                    'subject' => 'Confirm your subscription',
                    'body' => [new BodyPart(['content_type' => 'HTML', 'content' => $html])],
                ]),
            ]));

            return new JsonResponse(['success' => true, 'message' => 'Confirmation email sent', 'messageId' => $result->getMessageId()]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function doubleOptinConfirm(Request $request): Response
    {
        $email = (string) $request->query->get('email', '');
        $token = (string) $request->query->get('token', '');
        $secret = $this->ee->env('ELASTICEMAIL_WEBHOOK_TOKEN', 'change_me');
        $listName = $this->ee->env('ELASTICEMAIL_LIST_NAME', 'Newsletter');

        if ($email === '' || !hash_equals(hash_hmac('sha256', $email, $secret), $token)) {
            return new JsonResponse(['error' => 'Invalid confirmation link'], 400);
        }

        try {
            $this->ee->lists()->listsByNameContactsPost($listName, new EmailsPayload(['emails' => [$email]]));
            $redirect = $this->ee->env('CONFIRM_REDIRECT_URL');
            if ($redirect) {
                return new RedirectResponse($redirect);
            }
            return new JsonResponse(['confirmed' => true, 'email' => $email, 'list' => $listName]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
