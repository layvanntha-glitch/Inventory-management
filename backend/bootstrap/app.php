<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Handle CORS for all API requests
        $middleware->prependToGroup('api', \Illuminate\Http\Middleware\HandleCors::class);
        // Ensure API group forces JSON responses for unauthenticated/errors
        $middleware->appendToGroup('api', \App\Http\Middleware\ForceJsonForApi::class);

        // Role-based access control (e.g. ->middleware('role:master_admin'))
        $middleware->alias([
            'role' => \App\Http\Middleware\EnsureUserHasRole::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
