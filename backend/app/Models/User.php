<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable implements MustVerifyEmail
{
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasRoles;

    protected $fillable = [
        'public_id', 'name', 'email', 'password', 'phone', 'country',
        'is_active', 'is_suspended', 'suspension_reason',
        'last_login_at', 'last_login_ip',
        'terms_accepted_at', 'terms_version',
        'google_id', 'apple_id',
    ];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'last_login_at' => 'datetime',
            'terms_accepted_at' => 'datetime',
            'is_active' => 'boolean',
            'is_suspended' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (self $u) {
            if (! $u->public_id) $u->public_id = (string) Str::uuid();
        });
    }

    public function wallet(): HasOne         { return $this->hasOne(Wallet::class); }
    public function transactions(): HasMany  { return $this->hasMany(Transaction::class); }
    public function payments(): HasMany      { return $this->hasMany(Payment::class); }
    public function serviceOrders(): HasMany { return $this->hasMany(ServiceOrder::class); }

    public function getRouteKeyName(): string { return 'public_id'; }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new \App\Notifications\VerifyEmailNotification);
    }
}
