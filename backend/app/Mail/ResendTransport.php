<?php

namespace App\Mail;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\MessageConverter;

class ResendTransport extends AbstractTransport
{
    public function __construct(private string $apiKey)
    {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $to = array_map(fn($addr) => $addr->getAddress(), $email->getTo());
        $from = $email->getFrom()[0];
        $fromStr = $from->getName()
            ? "{$from->getName()} <{$from->getAddress()}>"
            : $from->getAddress();

        $payload = array_filter([
            'from'    => $fromStr,
            'to'      => $to,
            'subject' => $email->getSubject(),
            'html'    => $email->getHtmlBody(),
            'text'    => $email->getTextBody(),
        ]);

        $res = Http::withToken($this->apiKey)
            ->post('https://api.resend.com/emails', $payload);

        if ($res->failed()) {
            Log::error('resend.send_failed', ['status' => $res->status(), 'body' => $res->json()]);
            throw new \RuntimeException('Resend API error: ' . ($res->json('message') ?? 'Unknown'));
        }

        Log::info('resend.sent', ['id' => $res->json('id'), 'to' => $to]);
    }

    public function __toString(): string { return 'resend'; }
}
