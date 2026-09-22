<?php

use App\Http\Controllers\ContactController;
use App\Http\Controllers\DomainController;
use App\Http\Controllers\DoubleOptinController;
use App\Http\Controllers\EmailController;
use App\Http\Controllers\InboundController;
use App\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes (prefix /api)
|--------------------------------------------------------------------------
|
| Email sending and account management with the Elastic Email SDK.
|
*/

Route::get('/health', fn() => response()->json(['status' => 'ok']));

// Same shape as the other stacks: { to, subject, message } -> { success, transactionId, messageId }
Route::post('/send', function (\Illuminate\Http\Request $request, EmailController $controller) {
    $request->merge(['email' => $request->input('to')]);
    return $controller->sendDirect($request);
});

Route::prefix('send')->group(function () {
    Route::post('/welcome', [EmailController::class, 'sendWelcome']);
    Route::post('/direct', [EmailController::class, 'sendDirect']);
    Route::post('/scheduled', [EmailController::class, 'sendScheduled']);
    Route::post('/attachment', [EmailController::class, 'sendWithAttachment']);
    Route::post('/cid', [EmailController::class, 'sendWithCidAttachment']);
    Route::post('/template', [EmailController::class, 'sendWithTemplate']);
    Route::post('/prevent-threading', [EmailController::class, 'sendPreventThreading']);
    Route::post('/batch', [EmailController::class, 'sendBatch']);
});

// Contact form: confirmation to the sender + notification to CONTACT_EMAIL
Route::post('/contact', [EmailController::class, 'submitContactForm']);

// Elastic Email event notifications (GET is used by Elastic Email to validate the URL)
Route::match(['GET', 'POST'], '/webhook', [WebhookController::class, 'handle']);

// Inbound email pushed by an inbound route
Route::post('/inbound', [InboundController::class, 'handle']);

// Contacts and lists
Route::prefix('contacts')->group(function () {
    Route::get('/', [ContactController::class, 'index']);
    Route::post('/', [ContactController::class, 'store']);
    Route::get('/{email}', [ContactController::class, 'show']);
    Route::patch('/{email}', [ContactController::class, 'update']);
    Route::delete('/{email}', [ContactController::class, 'destroy']);
});

// Domains
Route::prefix('domains')->group(function () {
    Route::get('/', [DomainController::class, 'index']);
    Route::post('/', [DomainController::class, 'store']);
    Route::get('/{domain}', [DomainController::class, 'show']);
    Route::post('/{domain}/verify-tracking', [DomainController::class, 'verifyTracking']);
    Route::post('/{domain}/default', [DomainController::class, 'setDefault']);
});

// Double opt-in
Route::prefix('double-optin')->group(function () {
    Route::post('/subscribe', [DoubleOptinController::class, 'subscribe']);
    Route::get('/confirm', [DoubleOptinController::class, 'confirm']);
    Route::match(['GET', 'POST'], '/webhook', [DoubleOptinController::class, 'webhook']);
});
