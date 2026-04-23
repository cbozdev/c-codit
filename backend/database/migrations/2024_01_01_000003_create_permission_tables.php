<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        $teams = config('permission.teams');
        $tableNames = config('permission.table_names');
        $columnNames = config('permission.column_names');
        $pivotRole = $columnNames['role_pivot_key'] ?? 'role_id';
        $pivotPermission = $columnNames['permission_pivot_key'] ?? 'permission_id';

        Schema::create($tableNames['permissions'], function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('name');
            $t->string('guard_name');
            $t->timestamps();
            $t->unique(['name', 'guard_name']);
        });

        Schema::create($tableNames['roles'], function (Blueprint $t) {
            $t->bigIncrements('id');
            $t->string('name');
            $t->string('guard_name');
            $t->timestamps();
            $t->unique(['name', 'guard_name']);
        });

        Schema::create($tableNames['model_has_permissions'], function (Blueprint $t) use ($tableNames, $columnNames, $pivotPermission) {
            $t->unsignedBigInteger($pivotPermission);
            $t->string('model_type');
            $t->unsignedBigInteger($columnNames['model_morph_key']);
            $t->index([$columnNames['model_morph_key'], 'model_type'], 'model_has_permissions_model_id_model_type_index');
            $t->foreign($pivotPermission)->references('id')->on($tableNames['permissions'])->onDelete('cascade');
            $t->primary([$pivotPermission, $columnNames['model_morph_key'], 'model_type'], 'model_has_permissions_permission_model_type_primary');
        });

        Schema::create($tableNames['model_has_roles'], function (Blueprint $t) use ($tableNames, $columnNames, $pivotRole) {
            $t->unsignedBigInteger($pivotRole);
            $t->string('model_type');
            $t->unsignedBigInteger($columnNames['model_morph_key']);
            $t->index([$columnNames['model_morph_key'], 'model_type'], 'model_has_roles_model_id_model_type_index');
            $t->foreign($pivotRole)->references('id')->on($tableNames['roles'])->onDelete('cascade');
            $t->primary([$pivotRole, $columnNames['model_morph_key'], 'model_type'], 'model_has_roles_role_model_type_primary');
        });

        Schema::create($tableNames['role_has_permissions'], function (Blueprint $t) use ($tableNames, $pivotRole, $pivotPermission) {
            $t->unsignedBigInteger($pivotPermission);
            $t->unsignedBigInteger($pivotRole);
            $t->foreign($pivotPermission)->references('id')->on($tableNames['permissions'])->onDelete('cascade');
            $t->foreign($pivotRole)->references('id')->on($tableNames['roles'])->onDelete('cascade');
            $t->primary([$pivotPermission, $pivotRole], 'role_has_permissions_permission_id_role_id_primary');
        });

        app('cache')->store(config('permission.cache.store') != 'default' ? config('permission.cache.store') : null)
            ->forget(config('permission.cache.key'));
    }

    public function down(): void
    {
        $tableNames = config('permission.table_names');
        Schema::dropIfExists($tableNames['role_has_permissions']);
        Schema::dropIfExists($tableNames['model_has_roles']);
        Schema::dropIfExists($tableNames['model_has_permissions']);
        Schema::dropIfExists($tableNames['roles']);
        Schema::dropIfExists($tableNames['permissions']);
    }
};
