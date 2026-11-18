package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/wailsapp/wails/v3/pkg/services/notifications"
)

// Notifications have no frontend runtime API in Wails 3.1. This small service
// owns permission/error handling and lets the rest of the app start even when
// the platform notification service is unavailable (e.g. an unbundled macOS app).
type DesktopNotifications struct {
	mu         sync.Mutex
	native     *notifications.NotificationService
	startupErr error
}

func NewDesktopNotifications() *DesktopNotifications {
	return &DesktopNotifications{native: notifications.New()}
}

func (s *DesktopNotifications) ServiceStartup(ctx context.Context, options application.ServiceOptions) error {
	s.startupErr = s.native.ServiceStartup(ctx, options)
	return nil
}

func (s *DesktopNotifications) ServiceShutdown() error {
	// The platform can partially initialize before reporting a startup error.
	return s.native.ServiceShutdown()
}

type NotificationRequest struct {
	ID     string `json:"id"`
	Title  string `json:"title"`
	Body   string `json:"body"`
	Silent bool   `json:"silent"`
}

// Notify requests permission only in response to the caller's explicit action.
func (s *DesktopNotifications) Notify(request NotificationRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.startupErr != nil {
		return fmt.Errorf("desktop:unsupported: notifications: %w", s.startupErr)
	}
	allowed, err := s.native.CheckNotificationAuthorization()
	if err != nil {
		return fmt.Errorf("desktop:operation: check notification permission: %w", err)
	}
	if !allowed {
		allowed, err = s.native.RequestNotificationAuthorization()
		if err != nil {
			return fmt.Errorf("desktop:permission: request notification permission: %w", err)
		}
		if !allowed {
			return fmt.Errorf("desktop:permission: notifications are disabled in system settings")
		}
	}
	return s.native.SendNotification(notifications.NotificationOptions{
		ID: request.ID, Title: request.Title, Body: request.Body,
		Sound: &notifications.NotificationSound{Silent: request.Silent},
	})
}
