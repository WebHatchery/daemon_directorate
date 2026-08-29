<?php

declare(strict_types=1);

namespace App\Middleware;

use App\Core\Environment;
use App\Core\Request;
use App\Core\Response;
use RuntimeException;

final class WebHatcheryJwtMiddleware
{
    public function __invoke(Request $request, Response $response): Request|Response
    {
        $authHeader = $request->getHeader('authorization');
        if (!is_string($authHeader) || preg_match('/Bearer\s+(.*)$/i', $authHeader, $matches) !== 1) {
            return $this->unauthorized($response);
        }

        try {
            $secret = Environment::required('JWT_SECRET');
            $decoded = (new \WebHatchery\Auth\JwtAuthenticator($secret))->decode($matches[1]);
            $userId = $decoded->sub ?? $decoded->user_id ?? null;
            if ($userId === null) {
                throw new RuntimeException('Token missing user identifier');
            }

            $request->setAttribute('auth_user', [
                'id' => (string) $userId,
                'email' => isset($decoded->email) ? (string) $decoded->email : null,
                'username' => isset($decoded->username) ? (string) $decoded->username : null,
                'display_name' => isset($decoded->display_name)
                    ? (string) $decoded->display_name
                    : (isset($decoded->username) ? (string) $decoded->username : null),
                'roles' => is_array($decoded->roles ?? null) ? $decoded->roles : [],
                'is_guest' => (bool) ($decoded->is_guest ?? false),
                'auth_type' => isset($decoded->auth_type) ? (string) $decoded->auth_type : 'frontpage',
            ]);

            return $request;
        } catch (\Throwable) {
            return $this->unauthorized($response);
        }
    }

    private function unauthorized(Response $response): Response
    {
        $response->withStatus(401)->json([
            'success' => false,
            'error_code' => 'unauthorized',
            'error' => 'Authentication required',
            'message' => 'Authentication required',
            'login_url' => Environment::required('WEB_HATCHERY_LOGIN_URL'),
        ]);

        return $response;
    }
}


