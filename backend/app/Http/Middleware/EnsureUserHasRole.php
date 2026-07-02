<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserHasRole
{
    /**
     * Restrict a route to users holding one of the given roles.
     *
     * Usage in routes: ->middleware('role:master_admin')
     *                  ->middleware('role:master_admin,admin')
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        $user = $request->user();

        if (! $user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->active) {
            return response()->json(['message' => 'Your account has been deactivated.'], 403);
        }

        if (! empty($roles) && ! $user->hasRole(...$roles)) {
            return response()->json(['message' => 'You do not have permission to perform this action.'], 403);
        }

        return $next($request);
    }
}
