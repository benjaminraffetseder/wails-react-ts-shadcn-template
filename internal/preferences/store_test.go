package preferences

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
)

func ptr(s string) *string { return &s }
func fixture(t *testing.T) (*Store, string) {
	t.Helper()
	file := filepath.Join(t.TempDir(), "app", "settings.json")
	return New(func() (string, error) { return file, nil }), file
}

func TestDefaultsPersistenceAndMerge(t *testing.T) {
	s, file := fixture(t)
	first, err := s.Get()
	if err != nil || first.Theme != "system" || first.Language != "en" || first.Revision != 1 {
		t.Fatalf("defaults: %+v %v", first, err)
	}
	second, err := s.Get()
	if err != nil || first != second {
		t.Fatalf("read changed persisted defaults: %+v %v", second, err)
	}
	if _, err := s.Update(Patch{Theme: ptr("dark"), Language: ptr("de")}); err != nil {
		t.Fatal(err)
	}
	updated, err := s.Update(Patch{Theme: ptr("system")})
	if err != nil || updated.Language != "de" {
		t.Fatalf("partial merge: %+v %v", updated, err)
	}
	restarted := New(func() (string, error) { return file, nil })
	actual, err := restarted.Get()
	if err != nil || actual != updated {
		t.Fatalf("restart: %+v %v", actual, err)
	}
	before, _ := os.ReadFile(file)
	if _, err := s.Update(Patch{Language: ptr("xx")}); err == nil {
		t.Fatal("invalid update accepted")
	}
	after, _ := os.ReadFile(file)
	if string(before) != string(after) {
		t.Fatal("invalid update modified file")
	}
	reset, err := s.Reset()
	if err != nil || reset.Theme != "system" || reset.Language != "en" {
		t.Fatalf("reset: %+v %v", reset, err)
	}
}

func TestCorruptionRequiresExplicitRecovery(t *testing.T) {
	s, file := fixture(t)
	os.MkdirAll(filepath.Dir(file), 0700)
	os.WriteFile(file, []byte("{broken"), 0600)
	if _, err := s.Get(); err == nil || !strings.Contains(err.Error(), "settings:corrupt") {
		t.Fatalf("expected corruption error: %v", err)
	}
	if _, err := s.Update(Patch{Theme: ptr("dark")}); err == nil {
		t.Fatal("corrupt file overwritten")
	}
	if _, err := s.Reset(); err != nil {
		t.Fatal(err)
	}
	backups, _ := filepath.Glob(file + ".backup-*")
	if len(backups) != 1 {
		t.Fatal("missing corrupt file backup")
	}
	content, _ := os.ReadFile(backups[0])
	if string(content) != "{broken" {
		t.Fatal("backup changed content")
	}
}

func TestConcurrentWrites(t *testing.T) {
	s, _ := fixture(t)
	if _, err := s.Get(); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	for range 30 {
		wg.Go(func() {
			if _, err := s.Update(Patch{Theme: ptr("dark")}); err != nil {
				t.Error(err)
			}
		})
	}
	wg.Wait()
	value, err := s.Get()
	if err != nil || value.Revision != 31 {
		t.Fatalf("lost writes: %+v %v", value, err)
	}
}

func TestIOFailureDoesNotReportSave(t *testing.T) {
	blocker := filepath.Join(t.TempDir(), "file")
	os.WriteFile(blocker, []byte("occupied"), 0600)
	s := New(func() (string, error) { return filepath.Join(blocker, "settings.json"), nil })
	if _, err := s.Update(Patch{Theme: ptr("dark")}); err == nil {
		t.Fatal("I/O failure reported success")
	}
}

func TestUnsupportedSchemaIsPreserved(t *testing.T) {
	s, file := fixture(t)
	os.MkdirAll(filepath.Dir(file), 0700)
	content := []byte(`{"schemaVersion":99,"revision":1,"theme":"dark","language":"de"}`)
	os.WriteFile(file, content, 0600)
	if _, err := s.Get(); err == nil {
		t.Fatal("unsupported schema accepted")
	}
	after, _ := os.ReadFile(file)
	if string(after) != string(content) {
		t.Fatal("future settings overwritten")
	}
}

func TestRecoveryRevisionDoesNotGoBackwards(t *testing.T) {
	s, file := fixture(t)
	previous, err := s.Get()
	if err != nil {
		t.Fatal(err)
	}
	for range 4 {
		previous, err = s.Update(Patch{Theme: ptr("dark")})
		if err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Remove(file); err != nil {
		t.Fatal(err)
	}
	reset, err := s.Reset()
	if err != nil {
		t.Fatal(err)
	}
	if reset.Revision <= previous.Revision {
		t.Fatalf("reset revision went backwards: %d <= %d", reset.Revision, previous.Revision)
	}
}

func TestRevisionMustBeSafeForJavaScript(t *testing.T) {
	s, file := fixture(t)
	if _, err := s.Get(); err != nil {
		t.Fatal(err)
	}
	content := []byte(`{"schemaVersion":1,"revision":9223372036854775807,"theme":"dark","language":"de"}`)
	if err := os.WriteFile(file, content, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Update(Patch{Theme: ptr("light")}); err == nil {
		t.Fatal("unsafe revision accepted and incremented")
	}
	after, err := os.ReadFile(file)
	if err != nil || string(after) != string(content) {
		t.Fatal("invalid update changed the settings file")
	}
}
