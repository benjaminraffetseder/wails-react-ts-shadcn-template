package items

import (
	"path/filepath"
	"strings"
	"testing"
	"testing/fstest"
)

func TestCRUDRestartAndIdempotentMigrations(t *testing.T) {
	file := filepath.Join(t.TempDir(), "items.sqlite3")
	s, err := Open(file)
	if err != nil {
		t.Fatal(err)
	}
	item, err := s.Add("  A 'quoted' title  ")
	if err != nil || item.Title != "A 'quoted' title" {
		t.Fatalf("add: %+v %v", item, err)
	}
	if _, err := s.Update(item.ID, "", true); err == nil {
		t.Fatal("invalid title accepted")
	}
	if _, err := s.Update(item.ID, "Updated", true); err != nil {
		t.Fatal(err)
	}
	if err := migrate(s.db, migrations); err != nil {
		t.Fatal(err)
	}
	s.Close()
	s, err = Open(file)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	list, err := s.List()
	if err != nil || len(list) != 1 || list[0].Title != "Updated" || !list[0].Done {
		t.Fatalf("restart: %+v %v", list, err)
	}
	var versions int
	if err := s.db.QueryRow("SELECT count(*) FROM schema_migrations").Scan(&versions); err != nil || versions != 1 {
		t.Fatalf("duplicate migrations: %d %v", versions, err)
	}
	if err := s.Delete(item.ID); err != nil {
		t.Fatal(err)
	}
	if err := s.Delete(item.ID); err == nil {
		t.Fatal("missing row deletion accepted")
	}
}

func TestFailedMigrationRollsBack(t *testing.T) {
	s, err := Open(filepath.Join(t.TempDir(), "items.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	source := fstest.MapFS{
		"migrations/002_failure.sql": {Data: []byte("CREATE TABLE temporary_change(id); INSERT INTO items(title) VALUES ('');")},
	}
	if err := migrate(s.db, source); err == nil || !strings.Contains(err.Error(), "items:migration") {
		t.Fatalf("expected migration error: %v", err)
	}
	var count int
	if err := s.db.QueryRow("SELECT count(*) FROM sqlite_master WHERE name = 'temporary_change'").Scan(&count); err != nil || count != 0 {
		t.Fatal("failed migration did not roll back schema")
	}
	if _, err := s.Add("still healthy"); err != nil {
		t.Fatal(err)
	}
}

func TestInitializationAndQueryErrors(t *testing.T) {
	if _, err := Open("relative.sqlite3"); err == nil {
		t.Fatal("relative path allowed")
	}
	s, err := Open(filepath.Join(t.TempDir(), "items.sqlite3"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.Update(999, "Missing", false); err == nil || !strings.Contains(err.Error(), "items:constraint") {
		t.Fatalf("missing row: %v", err)
	}
	s.Close()
	if _, err := s.List(); err == nil || !strings.Contains(err.Error(), "items:query") {
		t.Fatalf("closed database: %v", err)
	}
}
