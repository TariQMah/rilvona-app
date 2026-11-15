-- Usernames are unique regardless of case. The API already lowercases them; this makes the database enforce it too,
-- so two requests racing for "Karan" and "karan" can never both succeed.
CREATE UNIQUE INDEX "user_profiles_username_lower_key" ON "user_profiles" (lower("username"));
