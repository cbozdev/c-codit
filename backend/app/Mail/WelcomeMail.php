<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class WelcomeMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public readonly User $user) {}

    public function envelope(): Envelope
    {
        return new Envelope(subject: 'Welcome to C-codit!');
    }

    public function content(): Content
    {
        return new Content(htmlString: $this->buildHtml());
    }

    private function buildHtml(): string
    {
        $name = htmlspecialchars($this->user->name, ENT_QUOTES, 'UTF-8');
        $year = date('Y');

        return <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Welcome to C-codit</title>
<style>
  body{margin:0;padding:0;background:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif}
  .wrap{max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 16px rgba(0,0,0,.09)}
  .header{background:linear-gradient(135deg,#dbeafe 0%,#ede9fe 100%);padding:40px 40px 32px;text-align:center}
  .logo{font-size:26px;font-weight:700;color:#1e293b;letter-spacing:-.5px}
  .body{padding:32px 40px}
  h1{font-size:22px;font-weight:600;color:#0f172a;margin:0 0 12px}
  p{font-size:15px;line-height:1.65;color:#475569;margin:0 0 18px}
  .btn{display:inline-block;background:#0f172a;color:#fff!important;text-decoration:none;padding:14px 28px;border-radius:10px;font-size:15px;font-weight:600;margin:4px 0 28px}
  .divider{border:none;border-top:1px solid #f1f5f9;margin:24px 0}
  .feature{display:flex;align-items:flex-start;gap:12px;margin-bottom:14px}
  .icon{font-size:20px;flex-shrink:0;margin-top:2px}
  .feat-text{font-size:14px;color:#475569;line-height:1.5}
  .feat-text b{color:#0f172a;display:block;margin-bottom:2px;font-weight:600}
  .footer{background:#f8fafc;padding:24px 40px;text-align:center;font-size:13px;color:#94a3b8}
  .footer a{color:#94a3b8;text-decoration:underline}
</style>
</head>
<body>
<div class="wrap">
  <div class="header">
    <div class="logo">C-codit</div>
  </div>
  <div class="body">
    <h1>Welcome, {$name}!</h1>
    <p>Your C-codit account is ready. You now have access to virtual numbers, eSIM data, gift cards, and utility bill payments — all in one wallet.</p>
    <a href="https://c-codit.com/dashboard" class="btn">Go to your dashboard →</a>
    <hr class="divider">
    <div class="feature"><span class="icon">📱</span><div class="feat-text"><b>Virtual Numbers</b>Receive SMS verification codes from 100+ countries in seconds.</div></div>
    <div class="feature"><span class="icon">🌍</span><div class="feat-text"><b>Travel eSIM</b>Stay connected in 190+ countries with instant QR code delivery — no physical SIM needed.</div></div>
    <div class="feature"><span class="icon">🎁</span><div class="feat-text"><b>Gift Cards</b>Amazon, Google Play, Apple, Netflix, Steam, Xbox, Spotify and more.</div></div>
    <div class="feature"><span class="icon">⚡</span><div class="feat-text"><b>Utility Bills</b>Airtime, data bundles, electricity, and TV subscriptions.</div></div>
    <hr class="divider">
    <p style="font-size:14px">Top up your wallet with a card or crypto and you're ready to go. Questions? Reply to this email — we're here to help.</p>
  </div>
  <div class="footer">
    © {$year} C-codit. You received this because you created an account.<br>
    <a href="https://c-codit.com">c-codit.com</a>
  </div>
</div>
</body>
</html>
HTML;
    }
}
