<?php
/**
 * Contacts and lists. Elastic Email lists are addressed by name, not by id.
 *
 * Usage: php src/contacts/manage.php
 */

require_once __DIR__ . '/../bootstrap.php';

use ElasticEmail\Api\ContactsApi;
use ElasticEmail\Api\ListsApi;
use ElasticEmail\Model\ContactPayload;
use ElasticEmail\Model\ContactUpdatePayload;
use ElasticEmail\Model\ListPayload;

$contactsApi = new ContactsApi(new GuzzleHttp\Client(), ee_config());
$listsApi = new ListsApi(new GuzzleHttp\Client(), ee_config());

$listName = ee_env('ELASTICEMAIL_LIST_NAME', 'Newsletter');
$email = ee_to();

// 1. Create the list
try {
    $listsApi->listsPost(new ListPayload(['list_name' => $listName, 'allow_unsubscribe' => true]));
    echo "List \"{$listName}\" created.\n";
} catch (Exception $e) {
    if (ee_already_exists($e)) {
        echo "List \"{$listName}\" already exists.\n";
    } else {
        ee_error($e, 'Error (create list)');
    }
}

// 2. Add a contact and put it on the list in one call
try {
    $contacts = $contactsApi->contactsPost(
        [
            new ContactPayload([
                'email' => $email,
                'first_name' => 'Ann',
                'last_name' => 'Example',
                'status' => 'Active',
                'custom_fields' => ['plan' => 'Pro'], // only existing custom fields are saved
            ]),
        ],
        [$listName]
    );
    $first = $contacts[0] ?? null;
    echo 'Contact added: ' . ($first ? $first->getEmail() . ' status: ' . $first->getStatus() : '(no data)') . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (add contact)');
}

// 3. Read it back
try {
    $contact = $contactsApi->contactsByEmailGet($email);
    echo 'Contact: ' . json_encode([
        'Email' => $contact->getEmail(),
        'FirstName' => $contact->getFirstName(),
        'Status' => $contact->getStatus(),
        'Source' => $contact->getSource(),
    ]) . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (get contact)');
}

// 4. Update
try {
    $contact = $contactsApi->contactsByEmailPut($email, new ContactUpdatePayload(['first_name' => 'Anna']));
    echo 'Contact updated. FirstName: ' . $contact->getFirstName() . "\n";
} catch (Exception $e) {
    ee_error($e, 'Error (update contact)');
}

// 5. List contacts on the list
try {
    $members = $listsApi->listsByListnameContactsGet($listName, 10, 0);
    echo "Contacts in \"{$listName}\" (first " . count($members) . "):\n";
    foreach ($members as $c) {
        echo ' - ' . $c->getEmail() . ' ' . $c->getStatus() . "\n";
    }
} catch (Exception $e) {
    ee_error($e, 'Error (list contacts)');
}

// 6. Delete the contact (uncomment to clean up)
// $contactsApi->contactsByEmailDelete($email);
// echo "Contact deleted.\n";

echo "\nDone.\n";
