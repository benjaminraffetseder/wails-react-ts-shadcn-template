package main

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/wailsapp/wails/v3/pkg/application"
)

func TestItemsServiceStartsWithoutBuildTags(t *testing.T) {
	file := filepath.Join(t.TempDir(), "items.sqlite3")
	start := func() *ItemsService {
		s := NewItemsService()
		s.path = func() (string, error) { return file, nil }
		if err := s.ServiceStartup(context.Background(), application.ServiceOptions{}); err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() { s.ServiceShutdown() })
		return s
	}
	s := start()
	item, err := s.AddItem("Persisted by default")
	if err != nil {
		t.Fatal(err)
	}
	if err := s.ServiceShutdown(); err != nil {
		t.Fatal(err)
	}
	restarted := start()
	items, err := restarted.GetItems()
	if err != nil || len(items) != 1 || items[0].ID != item.ID || items[0].Title != item.Title {
		t.Fatalf("restart: %+v %v", items, err)
	}
}

func TestItemsServiceReportsInitializationFailure(t *testing.T) {
	s := NewItemsService()
	s.path = func() (string, error) { return "", errors.New("data directory unavailable") }
	if err := s.ServiceStartup(context.Background(), application.ServiceOptions{}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetItems(); err == nil || !strings.Contains(err.Error(), "items:initialization") {
		t.Fatalf("expected visible initialization error: %v", err)
	}
	if err := s.ServiceShutdown(); err != nil {
		t.Fatal(err)
	}
}

func TestItemsServicePreservesCorruptDatabaseAndShutsDown(t *testing.T) {
	file := filepath.Join(t.TempDir(), "items.sqlite3")
	content := []byte("not a SQLite database")
	if err := os.WriteFile(file, content, 0600); err != nil {
		t.Fatal(err)
	}
	s := NewItemsService()
	s.path = func() (string, error) { return file, nil }
	if err := s.ServiceStartup(context.Background(), application.ServiceOptions{}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetItems(); err == nil {
		t.Fatal("corrupt database reported as ready")
	}
	if err := s.ServiceShutdown(); err != nil {
		t.Fatal(err)
	}
	after, err := os.ReadFile(file)
	if err != nil || string(after) != string(content) {
		t.Fatal("corrupt database was modified")
	}
}
