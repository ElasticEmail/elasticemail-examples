<?php

namespace App\Console\Commands;

use App\Services\ElasticEmail;
use Illuminate\Console\Command;

/**
 * Send a test email from the command line.
 *
 * Usage:
 *   php artisan email:send-test you@yourdomain.com
 *   php artisan email:send-test you@yourdomain.com --name="Ann"
 */
class SendTestEmail extends Command
{
    protected $signature = 'email:send-test
                            {email : The recipient email address}
                            {--name=Test User : Name used in the welcome view}';

    protected $description = 'Send a test email through the Elastic Email API';

    public function handle(ElasticEmail $ee): int
    {
        $email = $this->argument('email');
        $name = $this->option('name');

        $this->info("Sending test email to {$email}...");

        try {
            $html = view('emails.welcome', [
                'name' => $name,
                'actionUrl' => config('elasticemail.public_url'),
            ])->render();

            $result = $ee->sendHtml($email, "Welcome, {$name}!", $html);

            $this->info('Email sent.');
            $this->line('Transaction ID: ' . $result->getTransactionId());
            $this->line('Message ID: ' . $result->getMessageId());

            return Command::SUCCESS;
        } catch (\Exception $e) {
            $details = $ee->errorDetails($e);
            $this->error("Failed to send email: {$details['status']} {$details['message']}");
            return Command::FAILURE;
        }
    }
}
