CREATE TABLE items (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
    done INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1))
);
