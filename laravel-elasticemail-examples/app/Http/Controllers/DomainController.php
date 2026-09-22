<?php

namespace App\Http\Controllers;

use ElasticEmail\Model\DomainPayload;
use Illuminate\Http\Request;

/**
 * Sending domains. Verification happens once the SPF/DKIM/MX/DMARC records shown in the
 * Elastic Email dashboard are published.
 */
class DomainController extends Controller
{
    private function serialize($d): array
    {
        return [
            'domain' => $d->getDomain(),
            'spf' => (bool) $d->getSpf(),
            'dkim' => (bool) $d->getDkim(),
            'mx' => (bool) $d->getMx(),
            'dmarc' => (bool) $d->getDmarc(),
            'trackingStatus' => $d->getTrackingStatus(),
            'default' => (bool) $d->getDefaultDomain(),
            'dkimRecord' => $d->getDkimRecord(),
        ];
    }

    public function index()
    {
        try {
            return response()->json([
                'success' => true,
                'data' => array_map(fn($d) => $this->serialize($d), $this->ee->domains()->domainsGet()),
            ]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function show(string $domain)
    {
        try {
            return response()->json(['success' => true, 'data' => $this->serialize($this->ee->domains()->domainsByDomainGet($domain))]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * POST /api/domains { domain }. A 400 "already exists" is treated as success.
     */
    public function store(Request $request)
    {
        $request->validate(['domain' => 'nullable|string|max:255']);
        $domain = $request->input('domain', config('elasticemail.sending_domain'));

        if (!$domain) {
            return response()->json(['error' => 'Missing required field: domain'], 400);
        }

        try {
            try {
                $this->ee->domains()->domainsPost(new DomainPayload(['domain' => $domain]));
            } catch (\Exception $e) {
                $details = $this->ee->errorDetails($e);
                if (!($details['status'] === 400 && preg_match('/exist|already/i', $details['message']))) {
                    throw $e;
                }
            }

            return response()->json([
                'success' => true,
                'data' => $this->serialize($this->ee->domains()->domainsByDomainGet($domain)),
                'message' => 'Add the DNS records shown in the Elastic Email dashboard to verify the domain',
            ], 201);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * POST /api/domains/{domain}/verify-tracking. Checks the tracking CNAME.
     */
    public function verifyTracking(string $domain)
    {
        try {
            $this->ee->domains()->domainsByDomainVerificationPut($domain, 'Http');
            return response()->json(['success' => true, 'data' => $this->serialize($this->ee->domains()->domainsByDomainGet($domain))]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * POST /api/domains/{domain}/default { email }. Sets the account default sender.
     */
    public function setDefault(Request $request, string $domain)
    {
        $email = $request->input('email', "hello@{$domain}");

        try {
            $this->ee->domains()->domainsByEmailDefaultPatch($email);
            return response()->json(['success' => true, 'defaultSender' => $email]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
