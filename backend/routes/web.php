<?php

use Illuminate\Support\Facades\Route;

Route::get('/', fn () => response()->json([
    'success' => true,
    'message' => 'C-codit API',
    'data'    => ['version' => 'v1', 'docs' => '/api/health'],
]));
