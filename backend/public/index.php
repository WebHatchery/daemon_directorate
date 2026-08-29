<?php

declare(strict_types=1);
$centralAutoloader = __DIR__ . '/../../../../vendor/autoload.php';
if (file_exists($centralAutoloader)) {
    require_once $centralAutoloader;
}


$autoloader = null;
$searchPaths = [
    __DIR__ . '/../vendor/autoload.php',
    __DIR__ . '/../../vendor/autoload.php',
    __DIR__ . '/../../../vendor/autoload.php',
    __DIR__ . '/../../../../vendor/autoload.php',
    __DIR__ . '/../../../../../vendor/autoload.php',
];

foreach ($searchPaths as $path) {
    if (file_exists($path)) {
        $autoloader = $path;
        break;
    }
}

if ($autoloader === null) {
    throw new RuntimeException('Autoloader not found. Please run composer install.');
}

require $autoloader;

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    $baseDir = __DIR__ . '/../src/';

    if (strncmp($class, $prefix, strlen($prefix)) !== 0) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $file = $baseDir . str_replace('\\', '/', $relative) . '.php';
    if (file_exists($file)) {
        require $file;
    }
}, true, true);

use App\Core\Environment;
use App\Core\Router;
use Dotenv\Dotenv;

$envPath = __DIR__ . '/..';
if (!file_exists($envPath . '/.env')) {
    throw new RuntimeException('Missing .env at ' . $envPath . '/.env');
}

Dotenv::createImmutable($envPath)->load();

$allowedOrigin = Environment::required('CORS_ALLOWED_ORIGINS');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    header('Access-Control-Allow-Origin: ' . $allowedOrigin);
    header('Access-Control-Allow-Headers: Content-Type, Accept, Origin, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Max-Age: 86400');
    http_response_code(200);
    exit;
}

header('Access-Control-Allow-Origin: ' . $allowedOrigin);

$router = new Router();

$appBasePath = Environment::required('APP_BASE_PATH', allowEmpty: true);
if ($appBasePath !== '') {
    $router->setBasePath($appBasePath);
} else {
    $requestPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
    $apiPos = strpos($requestPath, '/api');
    if ($apiPos !== false) {
        $router->setBasePath(substr($requestPath, 0, $apiPos));
    }
}

(require __DIR__ . '/../src/Routes/router.php')($router);
$router->handle();


