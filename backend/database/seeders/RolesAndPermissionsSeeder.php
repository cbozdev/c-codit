<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();

        $permissions = [
            'wallet.view', 'wallet.fund', 'wallet.transact',
            'service.purchase', 'service.view',
            'admin.users.view', 'admin.users.manage',
            'admin.transactions.view',
            'admin.services.manage', 'admin.metrics.view',
        ];

        foreach ($permissions as $p) {
            Permission::firstOrCreate(['name' => $p, 'guard_name' => 'sanctum']);
        }

        $userRole = Role::firstOrCreate(['name' => 'user', 'guard_name' => 'sanctum']);
        $userRole->syncPermissions(['wallet.view', 'wallet.fund', 'wallet.transact', 'service.view', 'service.purchase']);

        $supportRole = Role::firstOrCreate(['name' => 'support', 'guard_name' => 'sanctum']);
        $supportRole->syncPermissions(['admin.users.view', 'admin.transactions.view']);

        $adminRole = Role::firstOrCreate(['name' => 'admin', 'guard_name' => 'sanctum']);
        $adminRole->syncPermissions(Permission::all());
    }
}
