<?php

namespace App\Http\Controllers;

use ElasticEmail\Model\ContactPayload;
use ElasticEmail\Model\ContactUpdatePayload;
use ElasticEmail\Model\ListPayload;
use Illuminate\Http\Request;

/**
 * Contacts and lists. Elastic Email lists are addressed by name, not by id.
 */
class ContactController extends Controller
{
    private function listName(Request $request): string
    {
        return (string) $request->input('list', config('elasticemail.list_name'));
    }

    private function serialize($c): array
    {
        return [
            'email' => $c->getEmail(),
            'firstName' => $c->getFirstName(),
            'lastName' => $c->getLastName(),
            'status' => $c->getStatus(),
            'source' => $c->getSource(),
            'dateAdded' => $c->getDateAdded() ? $c->getDateAdded()->format('c') : null,
        ];
    }

    /**
     * GET /api/contacts?list=Newsletter&limit=100&offset=0
     * Without ?list= returns account-wide contacts.
     */
    public function index(Request $request)
    {
        $limit = (int) $request->input('limit', 100);
        $offset = (int) $request->input('offset', 0);

        try {
            if ($request->filled('list')) {
                $contacts = $this->ee->lists()->listsByListnameContactsGet($request->input('list'), $limit, $offset);
            } else {
                $contacts = $this->ee->contacts()->contactsGet($limit, $offset);
            }

            return response()->json([
                'success' => true,
                'list' => $request->input('list'),
                'data' => array_map(fn($c) => $this->serialize($c), $contacts),
            ]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    /**
     * POST /api/contacts { email, first_name, last_name, list, custom_fields }
     * Creates the list if missing, then adds the contact to it in one call.
     */
    public function store(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'first_name' => 'nullable|string',
            'last_name' => 'nullable|string',
            'list' => 'nullable|string',
            'custom_fields' => 'nullable|array',
        ]);

        $listName = $this->listName($request);

        try {
            try {
                $this->ee->lists()->listsPost(new ListPayload(['list_name' => $listName, 'allow_unsubscribe' => true]));
            } catch (\Exception $e) {
                $details = $this->ee->errorDetails($e);
                if (!($details['status'] === 400 && preg_match('/exist|already/i', $details['message']))) {
                    throw $e;
                }
            }

            $payload = [
                'email' => $request->email,
                'first_name' => $request->input('first_name', ''),
                'last_name' => $request->input('last_name', ''),
                'status' => 'Active',
            ];
            if ($request->filled('custom_fields')) {
                $payload['custom_fields'] = $request->input('custom_fields'); // only existing custom fields are saved
            }

            $created = $this->ee->contacts()->contactsPost([new ContactPayload($payload)], [$listName]);

            return response()->json([
                'success' => true,
                'list' => $listName,
                'data' => isset($created[0]) ? $this->serialize($created[0]) : null,
            ], 201);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function show(string $email)
    {
        try {
            return response()->json(['success' => true, 'data' => $this->serialize($this->ee->contacts()->contactsByEmailGet($email))]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function update(Request $request, string $email)
    {
        $request->validate([
            'first_name' => 'nullable|string',
            'last_name' => 'nullable|string',
            'custom_fields' => 'nullable|array',
        ]);

        $payload = array_filter([
            'first_name' => $request->input('first_name'),
            'last_name' => $request->input('last_name'),
            'custom_fields' => $request->input('custom_fields'),
        ], fn($v) => $v !== null);

        try {
            $contact = $this->ee->contacts()->contactsByEmailPut($email, new ContactUpdatePayload($payload));
            return response()->json(['success' => true, 'data' => $this->serialize($contact)]);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }

    public function destroy(string $email)
    {
        try {
            $this->ee->contacts()->contactsByEmailDelete($email);
            return response()->json(['success' => true, 'message' => 'Contact deleted']);
        } catch (\Exception $e) {
            return $this->fail($e);
        }
    }
}
