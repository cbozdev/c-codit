<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserIpWhitelist extends Model
{
    protected $fillable = ['user_id', 'ip_address'];

    public function user() { return $this->belongsTo(User::class); }
}
