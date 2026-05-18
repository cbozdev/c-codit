<?php

namespace App\Support;

use App\Models\User;
use App\Models\UserNotification;

class UserNotify
{
    public static function send(User $user, string $type, string $title, string $body = '', array $data = []): void
    {
        UserNotification::create([
            'user_id' => $user->id,
            'type'    => $type,
            'title'   => $title,
            'body'    => $body ?: null,
            'data'    => $data ?: null,
        ]);
    }
}
