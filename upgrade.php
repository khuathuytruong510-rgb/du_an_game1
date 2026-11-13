<?php
declare(strict_types=1);

error_reporting(E_ALL);
ini_set('display_errors', '0');

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond(int $statusCode, array $payload): void
{
    http_response_code($statusCode);
    echo json_encode($payload, JSON_THROW_ON_ERROR);
    exit;
}

$requestOrigin = $_SERVER['HTTP_ORIGIN'] ?? '';
$configuredOrigin = getenv('GAME_ALLOWED_ORIGIN');
if (!is_string($configuredOrigin) || $configuredOrigin === '') {
    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $configuredOrigin = $host === '' ? '' : $scheme . '://' . $host;
}

if ($requestOrigin !== '') {
    if ($configuredOrigin === '' || !hash_equals($configuredOrigin, $requestOrigin)) {
        respond(403, ['error' => 'origin_not_allowed']);
    }

    header('Access-Control-Allow-Origin: ' . $configuredOrigin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 600');
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST, OPTIONS');
    respond(405, ['error' => 'method_not_allowed']);
}

$contentType = strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0]));
if ($contentType !== 'application/json') {
    respond(415, ['error' => 'content_type_must_be_json']);
}

$rawBody = file_get_contents('php://input');
if ($rawBody === false || strlen($rawBody) > 4096) {
    respond(400, ['error' => 'invalid_request_body']);
}

try {
    $request = json_decode($rawBody, true, 16, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    respond(400, ['error' => 'invalid_json']);
}

if (
    !is_array($request) ||
    !isset($request['user_id'], $request['inventory_id']) ||
    !is_int($request['user_id']) ||
    !is_int($request['inventory_id']) ||
    $request['user_id'] < 1 ||
    $request['inventory_id'] < 1
) {
    respond(400, ['error' => 'invalid_request']);
}

ini_set('session.use_strict_mode', '1');
ini_set('session.use_only_cookies', '1');
session_set_cookie_params([
    'httponly' => true,
    'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    'samesite' => 'Lax',
    'path' => '/',
]);
if (!session_start()) {
    respond(500, ['error' => 'session_unavailable']);
}

$sessionUserId = filter_var(
    $_SESSION['user_id'] ?? null,
    FILTER_VALIDATE_INT,
    ['options' => ['min_range' => 1]]
);
if ($sessionUserId === false) {
    respond(401, ['error' => 'authentication_required']);
}
if ($request['user_id'] !== $sessionUserId) {
    respond(403, ['error' => 'user_id_mismatch']);
}

$dbUser = getenv('GAME_DB_USER');
$dbPassword = getenv('GAME_DB_PASSWORD');
if (!is_string($dbUser) || $dbUser === '' || $dbPassword === false) {
    respond(500, ['error' => 'database_not_configured']);
}

$dbHost = getenv('GAME_DB_HOST') ?: '127.0.0.1';
$dbPort = getenv('GAME_DB_PORT') ?: '3306';
$dbName = getenv('GAME_DB_NAME') ?: 'game_db';
$costs = [1000, 2000, 3000];
$successChances = [90, 70, 50];

try {
    $pdo = new PDO(
        "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4",
        $dbUser,
        $dbPassword,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $pdo->beginTransaction();

    $userQuery = $pdo->prepare('SELECT gold FROM users WHERE id = :user_id FOR UPDATE');
    $userQuery->execute(['user_id' => $sessionUserId]);
    $goldValue = $userQuery->fetchColumn();
    if ($goldValue === false) {
        $pdo->rollBack();
        respond(404, ['error' => 'user_not_found']);
    }
    $gold = (int) $goldValue;

    $itemQuery = $pdo->prepare(
        'SELECT pi.id, pi.enhance_level, pi.current_atk, i.type
         FROM player_inventory AS pi
         INNER JOIN items AS i ON i.id = pi.item_id
         WHERE pi.id = :inventory_id AND pi.user_id = :user_id
         FOR UPDATE'
    );
    $itemQuery->execute([
        'inventory_id' => $request['inventory_id'],
        'user_id' => $sessionUserId,
    ]);
    $item = $itemQuery->fetch();
    if ($item === false) {
        $pdo->rollBack();
        respond(404, ['error' => 'weapon_not_found']);
    }
    if ($item['type'] !== 'weapon') {
        $pdo->rollBack();
        respond(422, ['error' => 'item_is_not_a_weapon']);
    }

    $level = (int) $item['enhance_level'];
    $currentAttack = (int) $item['current_atk'];
    if ($level < 0 || $level >= count($costs) || $currentAttack < 1) {
        $pdo->rollBack();
        respond(422, ['error' => 'weapon_cannot_be_enhanced']);
    }

    $cost = $costs[$level];
    if ($gold < $cost) {
        $pdo->rollBack();
        respond(422, ['error' => 'insufficient_gold']);
    }

    $succeeded = random_int(1, 100) <= $successChances[$level];
    $newLevel = $level + ($succeeded ? 1 : 0);
    $newAttack = $succeeded ? (int) round($currentAttack * 1.1) : $currentAttack;
    if ($newAttack > 2147483647) {
        $pdo->rollBack();
        respond(422, ['error' => 'weapon_stat_limit']);
    }

    $deductGold = $pdo->prepare(
        'UPDATE users SET gold = gold - :cost WHERE id = :user_id AND gold >= :minimum_gold'
    );
    $deductGold->execute([
        'cost' => $cost,
        'user_id' => $sessionUserId,
        'minimum_gold' => $cost,
    ]);
    if ($deductGold->rowCount() !== 1) {
        throw new RuntimeException('Gold deduction failed after row lock.');
    }

    if ($succeeded) {
        $updateWeapon = $pdo->prepare(
            'UPDATE player_inventory
             SET enhance_level = :new_level, current_atk = :current_atk
             WHERE id = :inventory_id AND user_id = :user_id'
        );
        $updateWeapon->execute([
            'new_level' => $newLevel,
            'current_atk' => $newAttack,
            'inventory_id' => $request['inventory_id'],
            'user_id' => $sessionUserId,
        ]);
        if ($updateWeapon->rowCount() !== 1) {
            throw new RuntimeException('Weapon update failed after row lock.');
        }
    }

    $pdo->commit();

    respond(200, [
        'status' => $succeeded ? 'success' : 'failed',
        'new_level' => $newLevel,
        'current_gold' => $gold - $cost,
        'current_atk' => $newAttack,
    ]);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Weapon enhancement database error: ' . $exception->getMessage());
    respond(500, ['error' => 'database_error']);
} catch (Random\RandomException $exception) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Weapon enhancement random source error: ' . $exception->getMessage());
    respond(500, ['error' => 'random_source_unavailable']);
} catch (RuntimeException $exception) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    error_log('Weapon enhancement transaction invariant failed: ' . $exception->getMessage());
    respond(500, ['error' => 'upgrade_failed']);
}
