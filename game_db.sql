CREATE DATABASE IF NOT EXISTS game_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE game_db;

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  gold INT UNSIGNED NOT NULL DEFAULT 0,
  guild_id INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY users_username_unique (username)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  base_atk INT UNSIGNED NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'weapon',
  PRIMARY KEY (id),
  UNIQUE KEY items_name_unique (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS player_inventory (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id INT UNSIGNED NOT NULL,
  item_id INT UNSIGNED NOT NULL,
  enhance_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  current_atk INT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY player_inventory_user_item_unique (user_id, item_id),
  CONSTRAINT player_inventory_user_fk
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT player_inventory_item_fk
    FOREIGN KEY (item_id) REFERENCES items (id)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO users (username, password_hash, gold, guild_id)
VALUES (
  'player1',
  '$2y$10$EqoJHkvzTm/OArw8EOEC.up.6LMADIIXQ7Qhb4MZDR8qubwFnYu2i',
  10000,
  NULL
);

INSERT IGNORE INTO items (name, base_atk, type)
VALUES
  ('Kiếm gỗ', 12, 'weapon'),
  ('Kiếm sắt', 20, 'weapon'),
  ('Kiếm rồng', 35, 'weapon');

INSERT IGNORE INTO player_inventory (user_id, item_id, enhance_level, current_atk)
SELECT users.id, items.id, 0, items.base_atk
FROM users
CROSS JOIN items
WHERE users.username = 'player1'
  AND items.name IN ('Kiếm gỗ', 'Kiếm sắt', 'Kiếm rồng');
