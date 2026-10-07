//go:build windows

package windowsjunction

import (
  "os"
  "path/filepath"
  "strings"
  "testing"
)

// TestCreateTreatsPathsAsData verifies junction paths retain shell metacharacters.
//
// Delayed environment expansion must preserve literal percent expressions and
// command metacharacters in both the target and the junction name.
//
//  1. Create a target containing an independently authored sentinel.
//  2. Create and read a junction with ampersand, caret, exclamation, percent and parentheses.
//  3. Assert exact sentinel content and absence of the environment-expanded link.
//
// @evidence contracts/testing.md#behavioral-verification Create makes a real junction whose sentinel reads safe through the literal metacharacter path; a shell-expanded alternate link must remain absent.
// @evidence contracts/testing.md#independent-expectations The literal path strings and authored safe bytes establish the expected filesystem effect independently of Create's command composition.
// @evidence contracts/testing.md#distinguishing-cases This case exercises metacharacters in both paths and contrasts the literal percent expression with its environment-expanded alternate; the existing-link case owns failure preservation.
// @evidence contracts/testing.md#execution-ownership This Windows Go unit calls the owning filesystem operation directly with a temporary directory and its necessary mklink builtin; it installs no consumer and builds or launches no product host. Go test discovers this Test entry without an e2e tag.
func TestCreateTreatsPathsAsData(t *testing.T) {
  t.Setenv("TTSC_WINDOWS_JUNCTION_PROBE", "expanded")
  root := t.TempDir()
  target := filepath.Join(root, "target & ^ ! %TTSC_WINDOWS_JUNCTION_PROBE% (literal)")
  link := filepath.Join(root, "link & ^ ! %TTSC_WINDOWS_JUNCTION_PROBE% (literal)")
  if err := os.Mkdir(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(target, "sentinel.txt"), []byte("safe"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := Create(link, target); err != nil {
    t.Fatal(err)
  }
  t.Cleanup(func() {
    if err := os.Remove(link); err != nil {
      t.Error(err)
    }
  })
  got, err := os.ReadFile(filepath.Join(link, "sentinel.txt"))
  if err != nil {
    t.Fatal(err)
  }
  if string(got) != "safe" {
    t.Fatalf("junction read %q, want safe", got)
  }
  expanded := strings.ReplaceAll(link, "%TTSC_WINDOWS_JUNCTION_PROBE%", "expanded")
  if _, err := os.Lstat(expanded); !os.IsNotExist(err) {
    t.Fatalf("environment-expanded alternate %s exists or cannot be observed: %v", expanded, err)
  }
}
