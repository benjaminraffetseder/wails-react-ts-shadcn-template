// Package preferences persists public preferences only. Never store secrets here.
package preferences

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
	"time"
)

type Settings struct {
	SchemaVersion int    `json:"schemaVersion"`
	Revision      int64  `json:"revision"`
	Theme         string `json:"theme"`
	Language      string `json:"language"`
}

type Patch struct {
	Theme    *string `json:"theme,omitempty"`
	Language *string `json:"language,omitempty"`
}

func Defaults() Settings { return Settings{SchemaVersion: 1, Theme: "system", Language: "en"} }

const maxRevision int64 = 1<<53 - 1 // JavaScript's largest exact integer.

func validate(s Settings) error {
	if s.SchemaVersion != 1 {
		return fmt.Errorf("settings:schema: unsupported schema version %d", s.SchemaVersion)
	}
	if s.Theme != "light" && s.Theme != "dark" && s.Theme != "system" {
		return errors.New("settings:validation: theme must be light, dark or system")
	}
	if s.Language != "en" && s.Language != "de" {
		return errors.New("settings:validation: language must be en or de")
	}
	if s.Revision < 0 || s.Revision > maxRevision {
		return errors.New("settings:validation: invalid revision")
	}
	return nil
}

func merge(s Settings, patch Patch) (Settings, error) {
	if patch.Theme != nil {
		s.Theme = *patch.Theme
	}
	if patch.Language != nil {
		s.Language = *patch.Language
	}
	return s, validate(s)
}

type Store struct {
	mu       sync.Mutex
	path     func() (string, error)
	revision int64
}

// New takes a path resolver so path and permission failures can reach the UI.
func New(path func() (string, error)) *Store { return &Store{path: path} }

func (s *Store) read() (Settings, bool, error) {
	file, err := s.path()
	if err != nil {
		return Defaults(), false, fmt.Errorf("settings:io: locate settings: %w", err)
	}
	content, err := os.ReadFile(file)
	if errors.Is(err, os.ErrNotExist) {
		return Defaults(), false, nil
	}
	if err != nil {
		return Defaults(), false, fmt.Errorf("settings:io: read settings: %w", err)
	}
	var settings Settings
	decoder := json.NewDecoder(bytes.NewReader(content))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(&settings); err != nil {
		return Defaults(), true, fmt.Errorf("settings:corrupt: %w", err)
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		return Defaults(), true, errors.New("settings:corrupt: unexpected trailing content")
	}
	if err := validate(settings); err != nil {
		return Defaults(), true, err
	}
	s.revision = max(s.revision, settings.Revision)
	return settings, true, nil
}

// Get creates defaults only when no native file exists. All windows share this
// store and lock, so concurrent first reads cannot overwrite saved preferences.
func (s *Store) Get() (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	settings, exists, err := s.read()
	if err != nil || exists {
		return settings, err
	}
	return s.commit(settings)
}

func (s *Store) Update(patch Patch) (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	settings, _, err := s.read()
	if err != nil {
		return Settings{}, err
	}
	settings, err = merge(settings, patch)
	if err != nil {
		return Settings{}, err
	}
	return s.commit(settings)
}

// Reset is explicit recovery. Preserve an unreadable/invalid file before reset;
// if the backup fails, leave the original untouched and report the error.
func (s *Store) Reset() (Settings, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	_, _, readErr := s.read()
	settings := Defaults()
	if readErr != nil {
		file, err := s.path()
		if err != nil {
			return Settings{}, err
		}
		content, err := os.ReadFile(file)
		if err != nil {
			return Settings{}, fmt.Errorf("settings:io: backup before reset: %w", err)
		}
		backup := fmt.Sprintf("%s.backup-%d", file, time.Now().UnixNano())
		if err := os.WriteFile(backup, content, 0600); err != nil {
			return Settings{}, fmt.Errorf("settings:io: backup before reset: %w", err)
		}
	}
	return s.commit(settings)
}

// Keep revisions increasing even if the file is deleted or replaced while the
// app is running, so mounted windows can accept explicit recovery operations.
func (s *Store) commit(settings Settings) (Settings, error) {
	if s.revision >= maxRevision {
		return Settings{}, errors.New("settings:validation: revision limit reached")
	}
	settings.Revision = s.revision + 1
	if err := s.write(settings); err != nil {
		return Settings{}, err
	}
	s.revision = settings.Revision
	return settings, nil
}

func (s *Store) write(settings Settings) error {
	file, err := s.path()
	if err != nil {
		return fmt.Errorf("settings:io: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(file), 0700); err != nil {
		return fmt.Errorf("settings:io: create directory: %w", err)
	}
	content, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return fmt.Errorf("settings:io: encode: %w", err)
	}
	tmp, err := os.CreateTemp(filepath.Dir(file), ".settings-*")
	if err != nil {
		return fmt.Errorf("settings:io: create temporary file: %w", err)
	}
	defer os.Remove(tmp.Name())
	defer tmp.Close()
	if err := tmp.Chmod(0600); err != nil {
		return fmt.Errorf("settings:io: permissions: %w", err)
	}
	if _, err := tmp.Write(append(content, '\n')); err != nil {
		return fmt.Errorf("settings:io: write: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		return fmt.Errorf("settings:io: sync: %w", err)
	}
	if err := tmp.Close(); err != nil {
		return fmt.Errorf("settings:io: close: %w", err)
	}
	// Same-directory rename replaces the destination without a delete-first gap.
	if err := os.Rename(tmp.Name(), file); err != nil {
		return fmt.Errorf("settings:io: replace: %w", err)
	}
	return nil
}
