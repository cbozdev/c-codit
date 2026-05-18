<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\UserNotification;
use App\Support\ApiResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $items = UserNotification::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get()
            ->map(fn ($n) => [
                'id'         => $n->id,
                'type'       => $n->type,
                'title'      => $n->title,
                'body'       => $n->body,
                'data'       => $n->data,
                'read'       => $n->read_at !== null,
                'created_at' => $n->created_at->toDateTimeString(),
            ]);

        $unread = UserNotification::where('user_id', $user->id)->whereNull('read_at')->count();

        return ApiResponse::ok(['items' => $items, 'unread' => $unread]);
    }

    public function markRead(Request $request, int $id)
    {
        $n = UserNotification::where('user_id', $request->user()->id)->findOrFail($id);
        $n->markRead();
        return ApiResponse::ok(null, 'Marked as read.');
    }

    public function markAllRead(Request $request)
    {
        UserNotification::where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);
        return ApiResponse::ok(null, 'All notifications marked as read.');
    }
}
