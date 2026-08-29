<?php

declare(strict_types=1);

namespace App\Actions;

use App\Core\Environment;
use App\Models\AuthUser;
use App\Repositories\GameRepository;
use RuntimeException;

final class LinkGuestAccountAction
{
    public function __construct(private readonly GameRepository $gameRepository)
    {
    }

    public function execute(AuthUser $targetUser, array $body): array
    {
        if ($targetUser->isGuest) {
            throw new RuntimeException('Guest sessions cannot merge another guest session.');
        }

        $guestToken = $body['guest_token'] ?? null;
        if (!is_string($guestToken) || trim($guestToken) === '') {
            throw new RuntimeException('Missing guest token.');
        }

        try {
            $decoded = (new \WebHatchery\Auth\JwtAuthenticator(Environment::required('JWT_SECRET')))->decode($guestToken);
        } catch (\Throwable) {
            throw new RuntimeException('Invalid guest token.');
        }
        if ((bool) ($decoded->is_guest ?? false) !== true) {
            throw new RuntimeException('Token is not a guest session.');
        }

        $guestUserId = $decoded->sub ?? $decoded->user_id ?? null;
        if (!is_string($guestUserId) || $guestUserId === '') {
            throw new RuntimeException('Guest token is missing a user identifier.');
        }

        return [
            'merged' => true,
            'game_state' => $this->gameRepository->moveGuestSaveToUser($guestUserId, $targetUser),
        ];
    }
}


