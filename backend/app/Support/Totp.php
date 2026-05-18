<?php

namespace App\Support;

class Totp
{
    private const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    public static function generateSecret(): string
    {
        return self::base32Encode(random_bytes(20));
    }

    public static function getUri(string $secret, string $email, string $issuer = 'C-codit'): string
    {
        return 'otpauth://totp/' . rawurlencode($issuer . ':' . $email)
            . '?secret=' . $secret
            . '&issuer=' . rawurlencode($issuer)
            . '&algorithm=SHA1&digits=6&period=30';
    }

    public static function verify(string $secret, string $code, int $window = 1): bool
    {
        $code = preg_replace('/\s/', '', $code);
        if (strlen($code) !== 6 || ! ctype_digit($code)) return false;

        $counter = (int) floor(time() / 30);
        for ($i = -$window; $i <= $window; $i++) {
            if (hash_equals(self::compute($secret, $counter + $i), $code)) return true;
        }
        return false;
    }

    private static function compute(string $secret, int $counter): string
    {
        $key  = self::base32Decode($secret);
        $time = pack('N*', 0) . pack('N*', $counter);
        $hash = hash_hmac('sha1', $time, $key, true);
        $offset = ord($hash[19]) & 0xf;
        $otp = (
            ((ord($hash[$offset])     & 0x7f) << 24) |
            ((ord($hash[$offset + 1]) & 0xff) << 16) |
            ((ord($hash[$offset + 2]) & 0xff) << 8)  |
            ( ord($hash[$offset + 3]) & 0xff)
        ) % 1000000;
        return str_pad((string) $otp, 6, '0', STR_PAD_LEFT);
    }

    private static function base32Encode(string $bytes): string
    {
        $out = '';
        $buf = 0; $bits = 0;
        foreach (str_split($bytes) as $byte) {
            $buf = ($buf << 8) | ord($byte);
            $bits += 8;
            while ($bits >= 5) {
                $bits -= 5;
                $out .= self::BASE32[($buf >> $bits) & 0x1f];
            }
        }
        if ($bits > 0) $out .= self::BASE32[($buf << (5 - $bits)) & 0x1f];
        return $out;
    }

    private static function base32Decode(string $input): string
    {
        $input = strtoupper(preg_replace('/\s/', '', $input) ?? '');
        $out = '';
        $buf = 0; $bits = 0;
        foreach (str_split($input) as $char) {
            $pos = strpos(self::BASE32, $char);
            if ($pos === false) continue;
            $buf = ($buf << 5) | $pos;
            $bits += 5;
            if ($bits >= 8) {
                $bits -= 8;
                $out .= chr(($buf >> $bits) & 0xff);
            }
        }
        return $out;
    }
}
