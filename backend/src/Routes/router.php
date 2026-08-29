<?php

declare(strict_types=1);

use App\Controllers\AuthController;
use App\Controllers\GameController;
use App\Controllers\SystemController;
use App\Middleware\WebHatcheryJwtMiddleware;

return static function (\App\Core\Router $router): void {
    $auth = [WebHatcheryJwtMiddleware::class];

    $router->get('/api/v1/health', [SystemController::class, 'health']);
    $router->get('/api/v1/auth/login-info', [AuthController::class, 'loginInfo']);
    $router->get('/api/v1/auth/session', [AuthController::class, 'session'], $auth);
    $router->post('/api/v1/auth/guest-session', [AuthController::class, 'guestSession']);
    $router->post('/api/v1/auth/link-guest', [AuthController::class, 'linkGuest'], $auth);

    $router->get('/api/v1/game', [GameController::class, 'current'], $auth);
    $router->post('/api/v1/game/start', [GameController::class, 'start'], $auth);
    $router->post('/api/v1/game/save', [GameController::class, 'save'], $auth);
    $router->post('/api/v1/game/action/{action_type}', [GameController::class, 'action'], $auth);
};

