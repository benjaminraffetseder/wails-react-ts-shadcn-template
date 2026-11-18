package items

import (
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrations embed.FS

type Store struct{ db *sql.DB }

func Open(file string) (*Store, error) {
	if !filepath.IsAbs(file) {
		return nil, errors.New("items:initialization: database path must be absolute")
	}
	if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
		return nil, fmt.Errorf("items:initialization: %w", err)
	}
	db, err := sql.Open("sqlite", file)
	if err != nil {
		return nil, fmt.Errorf("items:initialization: %w", err)
	}
	// One connection preserves connection-local PRAGMAs and serializes writers.
	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	for _, pragma := range []string{"PRAGMA busy_timeout = 5000", "PRAGMA foreign_keys = ON", "PRAGMA journal_mode = WAL"} {
		if _, err := db.Exec(pragma); err != nil {
			db.Close()
			return nil, fmt.Errorf("items:initialization: %w", err)
		}
	}
	if err := migrate(db, migrations); err != nil {
		db.Close()
		return nil, err
	}
	return &Store{db: db}, nil
}

// All pending migrations and their version records commit together. Any failure
// rolls back this startup's changes and prevents the service from accessing data.
func migrate(db *sql.DB, source fs.FS) error {
	files, err := fs.Glob(source, "migrations/*.sql")
	if err != nil {
		return fmt.Errorf("items:migration: %w", err)
	}
	sort.Strings(files)
	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("items:migration: %w", err)
	}
	defer tx.Rollback()
	if _, err := tx.Exec("CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY)"); err != nil {
		return fmt.Errorf("items:migration: %w", err)
	}
	previous := 0
	for _, file := range files {
		prefix, _, _ := strings.Cut(filepath.Base(file), "_")
		version, err := strconv.Atoi(prefix)
		if err != nil || version <= previous {
			return fmt.Errorf("items:migration: invalid migration order: %s", file)
		}
		previous = version
		var applied int
		if err := tx.QueryRow("SELECT count(*) FROM schema_migrations WHERE version = ?", version).Scan(&applied); err != nil {
			return fmt.Errorf("items:migration: %w", err)
		}
		if applied != 0 {
			continue
		}
		content, err := fs.ReadFile(source, file)
		if err != nil {
			return fmt.Errorf("items:migration: %s: %w", file, err)
		}
		if _, err := tx.Exec(string(content)); err != nil {
			return fmt.Errorf("items:migration: %s: %w", file, err)
		}
		if _, err := tx.Exec("INSERT INTO schema_migrations(version) VALUES (?)", version); err != nil {
			return fmt.Errorf("items:migration: %w", err)
		}
	}
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("items:migration: %w", err)
	}
	return nil
}

func queryError(err error) error {
	var native *sqlite.Error
	if errors.As(err, &native) && native.Code()&0xff == 19 {
		return fmt.Errorf("items:constraint: %w", err)
	}
	if errors.Is(err, sql.ErrNoRows) {
		return errors.New("items:constraint: item no longer exists")
	}
	return fmt.Errorf("items:query: %w", err)
}

func title(value string) (string, error) {
	value = strings.TrimSpace(value)
	if len([]rune(value)) < 1 || len([]rune(value)) > 200 {
		return "", errors.New("items:constraint: title must contain 1 to 200 characters")
	}
	return value, nil
}

func (s *Store) List() ([]Item, error) {
	rows, err := s.db.Query("SELECT id, title, done FROM items ORDER BY id DESC")
	if err != nil {
		return nil, queryError(err)
	}
	defer rows.Close()
	result := []Item{}
	for rows.Next() {
		var item Item
		if err := rows.Scan(&item.ID, &item.Title, &item.Done); err != nil {
			return nil, queryError(err)
		}
		result = append(result, item)
	}
	if err := rows.Err(); err != nil {
		return nil, queryError(err)
	}
	return result, nil
}

func (s *Store) Add(value string) (Item, error) {
	value, err := title(value)
	if err != nil {
		return Item{}, err
	}
	var item Item
	err = s.db.QueryRow("INSERT INTO items(title) VALUES (?) RETURNING id, title, done", value).Scan(&item.ID, &item.Title, &item.Done)
	if err != nil {
		return Item{}, queryError(err)
	}
	return item, nil
}

func (s *Store) Update(id int64, value string, done bool) (Item, error) {
	value, err := title(value)
	if err != nil {
		return Item{}, err
	}
	var item Item
	err = s.db.QueryRow("UPDATE items SET title = ?, done = ? WHERE id = ? RETURNING id, title, done", value, done, id).Scan(&item.ID, &item.Title, &item.Done)
	if err != nil {
		return Item{}, queryError(err)
	}
	return item, nil
}

func (s *Store) Delete(id int64) error {
	result, err := s.db.Exec("DELETE FROM items WHERE id = ?", id)
	if err != nil {
		return queryError(err)
	}
	count, err := result.RowsAffected()
	if err != nil {
		return queryError(err)
	}
	if count != 1 {
		return errors.New("items:constraint: item no longer exists")
	}
	return nil
}

func (s *Store) Close() error { return s.db.Close() }
