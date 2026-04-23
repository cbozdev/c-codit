<?php

namespace App\Notifications;

use Illuminate\Auth\Notifications\VerifyEmail;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\URL;

class VerifyEmailNotification extends VerifyEmail
{
    use Queueable;

    public int $tries = 5;
    public int $backoff = 60;

    protected function verificationUrl($notifiable): string
    {
        $temporarySignedUrl = URL::temporarySignedRoute(
            'verification.verify',
            Carbon::now()->addMinutes(60),
            ['id' => $notifiable->getKey(), 'hash' => sha1($notifiable->getEmailForVerification())]
        );
        // Point the URL at the frontend verification page, passing the API url as a query param.
        $frontend = rtrim((string) config('app.frontend_url'), '/');
        return $frontend.'/verify-email?link='.urlencode($temporarySignedUrl);
    }

    public function toMail($notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Verify your C-codit account')
            ->greeting("Hi {$notifiable->name},")
            ->line('Thanks for signing up. Please verify your email to activate all features.')
            ->action('Verify email', $this->verificationUrl($notifiable))
            ->line('If you didn\'t create an account, you can safely ignore this email.');
    }
}
