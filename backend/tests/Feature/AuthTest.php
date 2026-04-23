<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    }

    public function test_user_can_register(): void
    {
        $res = $this->postJson('/api/v1/auth/register', [
            'name'                  => 'Test User',
            'email'                 => 'test@example.com',
            'password'              => 'StrongPass!2025',
            'password_confirmation' => 'StrongPass!2025',
            'accept_terms'          => true,
        ]);

        $res->assertCreated()
            ->assertJsonStructure(['success', 'message', 'data' => ['user' => ['id', 'email'], 'token']]);

        $this->assertDatabaseHas('users', ['email' => 'test@example.com']);
    }

    public function test_invalid_credentials_are_rejected(): void
    {
        User::factory()->create(['email' => 'a@b.com', 'password' => 'CorrectPass!2025']);
        $res = $this->postJson('/api/v1/auth/login', [
            'email'    => 'a@b.com',
            'password' => 'WrongPassword!',
        ]);
        $res->assertStatus(422);
    }

    public function test_authenticated_user_can_view_profile(): void
    {
        $user = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withHeaders(['Authorization' => "Bearer {$token}"])
            ->getJson('/api/v1/auth/me')
            ->assertOk()
            ->assertJsonPath('data.email', $user->email);
    }
}
