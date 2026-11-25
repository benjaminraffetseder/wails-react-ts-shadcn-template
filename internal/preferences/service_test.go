package preferences

import "testing"

func TestSettingsServicePublishesCommittedChanges(t *testing.T) {
	store, file := fixture(t)
	var published []Settings
	s := NewSettingsService(func(settings Settings) {
		persisted, err := New(func() (string, error) { return file, nil }).Get()
		if err != nil || persisted != settings {
			t.Fatalf("published before persistence: %+v, saved %+v, error %v", settings, persisted, err)
		}
		published = append(published, settings)
	})
	s.store = store

	if _, err := s.GetSettings(); err != nil {
		t.Fatal(err)
	}
	if len(published) != 0 {
		t.Fatal("reading settings published a change")
	}
	updated, err := s.UpdateSettings(Patch{Theme: ptr("dark"), Language: ptr("de")})
	if err != nil {
		t.Fatal(err)
	}
	if len(published) != 1 || published[0] != updated {
		t.Fatalf("update event: %+v, want %+v", published, updated)
	}
	if _, err := s.UpdateSettings(Patch{Language: ptr("invalid")}); err == nil {
		t.Fatal("invalid update accepted")
	}
	if len(published) != 1 {
		t.Fatal("failed update published a change")
	}
	reset, err := s.ResetSettings()
	if err != nil {
		t.Fatal(err)
	}
	if len(published) != 2 || published[1] != reset || reset.Theme != "system" || reset.Language != "en" || reset.Revision <= updated.Revision {
		t.Fatalf("reset event: %+v, want %+v", published, reset)
	}
}

func TestSettingsServiceDoesNotPublishFailedWrites(t *testing.T) {
	// A directory at the settings path prevents both saving and reset recovery.
	file := t.TempDir()
	s := NewSettingsService(func(Settings) { t.Fatal("failed write published a change") })
	s.store = New(func() (string, error) { return file, nil })
	if _, err := s.UpdateSettings(Patch{Theme: ptr("dark")}); err == nil {
		t.Fatal("failed update reported success")
	}
	if _, err := s.ResetSettings(); err == nil {
		t.Fatal("failed reset reported success")
	}
}
