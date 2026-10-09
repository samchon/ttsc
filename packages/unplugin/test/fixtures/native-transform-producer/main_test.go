package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// TestCacheLifetimeReceiptsAuthenticateRelease Verifies the actual native gate's
// publication and release operations preserve invocation identity.
//
// A missing or incomplete release keeps the original held; malformed or foreign release data
// must never grant permission to finish. Filesystem errors stay distinct from
// both valid release and ordinary absence.
//
// 1. Publish a literal receipt exclusively and verify duplicate refusal.
// 2. Contrast absent and matching releases with foreign and malformed data.
// 3. Refuse real nonregular paths and preserve an actual failed-write cause.
//
// @evidence contracts/testing.md#behavioral-verification Calls the same publication/release operations used by cacheHoldNativeLifetime against real exclusive temporary files, asserting results and unchanged bytes.
// @evidence contracts/testing.md#independent-expectations Literal session/token/PID values and independently authored release bytes distinguish identity from the operation's own expected values.
// @evidence contracts/testing.md#distinguishing-cases Missing, matching, wrong session/token/PID, malformed, unknown/trailing data, duplicate publication, nonregular release and failed publication remain distinct outcomes.
// @evidence contracts/testing.md#execution-ownership One Go test process executes portable filesystem operations without another native transform, compiler, observer process or mocked OS primitive. The ordinary Metro corpus owns actual held-native enrollment and retirement.
func TestCacheLifetimeReceiptsAuthenticateRelease(t *testing.T) {
	expected := cacheLifetimeReceipt{Session: "owner-session", Token: "invocation-token", PID: 123}
	t.Run("exclusive publication", func(t *testing.T) {
		file := filepath.Join(t.TempDir(), "ready.json")
		if err := cachePublishLifetime(file, expected); err != nil {
			t.Fatal(err)
		}
		before, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		if err := cachePublishLifetime(file, cacheLifetimeReceipt{Session: "foreign"}); err == nil {
			t.Fatal("duplicate publication replaced an original receipt")
		}
		after, err := os.ReadFile(file)
		if err != nil || string(before) != string(after) {
			t.Fatalf("original receipt changed: %q, %v", after, err)
		}
		var actual cacheLifetimeReceipt
		if err := json.Unmarshal(after, &actual); err != nil || actual != expected {
			t.Fatalf("published identity: %+v, %v", actual, err)
		}
	})
	for _, row := range []struct {
		name string
		data string
		ok   bool
	}{
		{"matching", `{"session":"owner-session","token":"invocation-token","pid":123}`, true},
		{"wrong session", `{"session":"foreign","token":"invocation-token","pid":123}`, false},
		{"wrong token", `{"session":"owner-session","token":"foreign","pid":123}`, false},
		{"wrong pid", `{"session":"owner-session","token":"invocation-token","pid":124}`, false},
		{"malformed", `{`, false},
		{"unknown field", `{"session":"owner-session","token":"invocation-token","pid":123,"extra":true}`, false},
		{"trailing data", `{"session":"owner-session","token":"invocation-token","pid":123} {}`, false},
	} {
		t.Run(row.name, func(t *testing.T) {
			file := filepath.Join(t.TempDir(), "release")
			if err := os.WriteFile(file, []byte(row.data+"\n"), 0o600); err != nil {
				t.Fatal(err)
			}
			ok, err := cacheLifetimeReleased(file, expected)
			if ok != row.ok || (err == nil) != row.ok {
				t.Fatalf("release = %v, %v; want success %v", ok, err, row.ok)
			}
		})
	}
	t.Run("absent and nonregular release", func(t *testing.T) {
		file := filepath.Join(t.TempDir(), "release")
		if ok, err := cacheLifetimeReleased(file, expected); ok || err != nil {
			t.Fatalf("absence = %v, %v", ok, err)
		}
		if err := os.Mkdir(file, 0o700); err != nil {
			t.Fatal(err)
		}
		if ok, err := cacheLifetimeReleased(file, expected); ok || err == nil {
			t.Fatalf("directory accepted: %v, %v", ok, err)
		}
	})
	t.Run("incomplete release remains pending", func(t *testing.T) {
		file := filepath.Join(t.TempDir(), "release")
		if err := os.WriteFile(file, []byte(`{"session":`), 0o600); err != nil {
			t.Fatal(err)
		}
		if ok, err := cacheLifetimeReleased(file, expected); ok || err != nil {
			t.Fatalf("partial publication = %v, %v", ok, err)
		}
		if err := os.WriteFile(file, []byte("{\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		if ok, err := cacheLifetimeReleased(file, expected); ok || err == nil {
			t.Fatalf("complete malformed publication = %v, %v", ok, err)
		}
	})
	t.Run("actual publication and release IO error", func(t *testing.T) {
		blocker := filepath.Join(t.TempDir(), "regular-file")
		if err := os.WriteFile(blocker, []byte("original"), 0o600); err != nil {
			t.Fatal(err)
		}
		file := filepath.Join(blocker, "release")
		if err := cachePublishLifetime(file, expected); err == nil {
			t.Fatal("publication through a regular parent unexpectedly succeeded")
		}
		if ok, err := cacheLifetimeReleased(file, expected); ok || err == nil {
			t.Fatalf("release IO failure lost: %v, %v", ok, err)
		}
		data, err := os.ReadFile(blocker)
		if err != nil || string(data) != "original" {
			t.Fatalf("blocker changed: %q, %v", data, err)
		}
	})
}
