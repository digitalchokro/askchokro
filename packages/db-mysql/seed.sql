-- MySQL integration test seed data
CREATE TABLE IF NOT EXISTS users (
  id   INT         NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS posts (
  id      INT  NOT NULL AUTO_INCREMENT,
  user_id INT  NOT NULL,
  title   VARCHAR(255) NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users (id)
);

INSERT INTO users (name, email) VALUES
  ('Alice', 'alice@example.com'),
  ('Bob',   'bob@example.com');

INSERT INTO posts (user_id, title) VALUES
  (1, 'Hello World'),
  (1, 'Second Post'),
  (2, "Bob's First Post");
