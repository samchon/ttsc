package main

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
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

// TestGenericAwaitReleaseObservesOwnedFiles Verifies a held transform follows
// actual release, owner withdrawal and filesystem failures.
//
// The barrier publishes the native read before its caller changes source. The
// caller must release or withdraw that hold and join it before input cleanup.
//
// 1. Release an existing or genuinely pending hold through a regular file.
// 2. Withdraw a published barrier and preserve its actual absence cause.
// 3. Refuse nonregular release paths and preserve publication/parent failures,
//    including removal of unpublished staging files after rename failure.
//
// @evidence contracts/testing.md#behavioral-verification Calls genericAwaitRelease against real temporary files, observes its published barrier, and joins each original goroutine before cleanup. Release and withdrawal supply actual outcomes.
// @evidence contracts/testing.md#independent-expectations The caller writes or removes distinct literal paths after observing the real barrier; errors.As/Is check original filesystem failure identity rather than a duration or source shape.
// @evidence contracts/testing.md#distinguishing-cases Already released, pending release, withdrawn barrier, missing config, nonregular release, blocked release parent, failed barrier creation and failed rename without leftover staging remain independent subcases.
// @evidence contracts/testing.md#execution-ownership The normal standalone fixture Go population runs these portable filesystem/goroutine cases in one process without building or launching another compiler or transform producer. The explicitly invoked retained dependency-witness test owns the real JS/native connection.
func TestGenericAwaitReleaseObservesOwnedFiles(t *testing.T) {
	t.Run("missing configuration", func(t *testing.T) {
		if err := genericAwaitRelease(map[string]any{}); err == nil {
			t.Fatal("missing barrier/release accepted")
		}
	})
	t.Run("existing release", func(t *testing.T) {
		root := t.TempDir()
		barrier, release := filepath.Join(root, "barrier"), filepath.Join(root, "release")
		if err := os.WriteFile(release, nil, 0o600); err != nil {
			t.Fatal(err)
		}
		if err := genericAwaitRelease(map[string]any{"barrier": barrier, "release": release}); err != nil {
			t.Fatal(err)
		}
		if info, err := os.Stat(barrier); err != nil || !info.Mode().IsRegular() {
			t.Fatalf("barrier publication = %v, %v", info, err)
		}
	})
	for _, withdraw := range []bool{false, true} {
		name := "pending release"
		if withdraw {
			name = "withdrawn barrier"
		}
		t.Run(name, func(t *testing.T) {
			root := t.TempDir()
			barrier, release := filepath.Join(root, "barrier"), filepath.Join(root, "release")
			done := make(chan struct{})
			var result error
			go func() {
				result = genericAwaitRelease(map[string]any{"barrier": barrier, "release": release})
				close(done)
			}()
			t.Cleanup(func() {
				if err := os.WriteFile(release, nil, 0o600); err != nil {
					t.Error(err)
				}
				<-done
			})
			for {
				if _, err := os.Stat(barrier); err == nil {
					break
				} else if !os.IsNotExist(err) {
					t.Fatal(err)
				}
				select {
				case <-done:
					t.Fatalf("hold returned before its barrier: %v", result)
				default:
					runtime.Gosched()
				}
			}
			select {
			case <-done:
				t.Fatalf("unreleased hold returned: %v", result)
			default:
			}
			if withdraw {
				if err := os.Remove(barrier); err != nil {
					t.Fatal(err)
				}
			} else if err := os.WriteFile(release, nil, 0o600); err != nil {
				t.Fatal(err)
			}
			<-done
			if withdraw {
				if !errors.Is(result, os.ErrNotExist) {
					t.Fatalf("withdrawal lost filesystem cause: %v", result)
				}
			} else if result != nil {
				t.Fatal(result)
			}
		})
	}
	t.Run("nonregular release", func(t *testing.T) {
		root := t.TempDir()
		release := filepath.Join(root, "release")
		if err := os.Mkdir(release, 0o700); err != nil {
			t.Fatal(err)
		}
		if err := genericAwaitRelease(map[string]any{"barrier": filepath.Join(root, "barrier"), "release": release}); err == nil {
			t.Fatal("directory accepted as release")
		}
	})
	t.Run("failed publication preserves barrier and removes staging", func(t *testing.T) {
		root := t.TempDir()
		barrier := filepath.Join(root, "barrier")
		if err := os.Mkdir(barrier, 0o700); err != nil {
			t.Fatal(err)
		}
		err := genericAwaitRelease(map[string]any{"barrier": barrier, "release": filepath.Join(root, "release")})
		var linkError *os.LinkError
		if !errors.As(err, &linkError) || linkError.New != barrier {
			t.Fatalf("publication failure lost original rename cause: %v", err)
		}
		entries, err := os.ReadDir(root)
		if err != nil || len(entries) != 1 || entries[0].Name() != "barrier" || !entries[0].IsDir() {
			t.Fatalf("publication failure changed owner files: %v, %v", entries, err)
		}
	})
	t.Run("actual publication and parent failures", func(t *testing.T) {
		root := t.TempDir()
		blocker := filepath.Join(root, "regular-file")
		if err := os.WriteFile(blocker, []byte("original"), 0o600); err != nil {
			t.Fatal(err)
		}
		barrier := filepath.Join(blocker, "barrier")
		err := genericAwaitRelease(map[string]any{"barrier": barrier, "release": filepath.Join(root, "release")})
		var pathError *os.PathError
		if !errors.As(err, &pathError) || filepath.Dir(pathError.Path) != blocker {
			t.Fatalf("publication cause = %v", err)
		}
		if err := genericAwaitRelease(map[string]any{"barrier": filepath.Join(root, "barrier"), "release": filepath.Join(blocker, "release")}); err == nil {
			t.Fatal("regular parent accepted")
		}
		if data, err := os.ReadFile(blocker); err != nil || string(data) != "original" {
			t.Fatalf("original blocker changed: %q, %v", data, err)
		}
	})
}
