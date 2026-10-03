//go:build windows && e2e

package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestWindowsJunctionTreatsPathsAsData verifies a junction is created with shell
// metacharacters treated as data.
//
// Ampersand, caret, exclamation, percent and parentheses in a path must not be
// expanded.
//
//  1. Create a junction whose path contains the metacharacters.
//  2. Read the sentinel file through the link.
//  3. Assert the content is exact and the environment-expanded alternate path does
//     not exist.
//
// @evidence contracts/testing.md#behavioral-verification windowsjunction.Create creates a real link whose sentinel reads safe and whose literal percent sequence does not create an environment-expanded alternate path.
// @evidence contracts/testing.md#independent-expectations The authored sentinel safe and literal metacharacter paths independently require exact content and absence of the expanded spelling.
// @evidence contracts/testing.md#distinguishing-cases Owns ampersand, caret, exclamation, percent and parentheses in actual junction paths, contrasting the literal link with the environment-expanded alternate; ordinary junction fingerprinting has its separate kernel case.
// @evidence contracts/testing.md#execution-ownership test_e2e_installation selects TestWindowsJunctionTreatsPathsAsData exactly once with the e2e build tag in the Windows setup row; the windows constraint excludes non-Windows execution.
func TestWindowsJunctionTreatsPathsAsData(t *testing.T) {
  t.Setenv("TTSC_WINDOWS_JUNCTION_PROBE", "expanded")
  root := t.TempDir()
  target := filepath.Join(root, "target & ^ ! %TTSC_WINDOWS_JUNCTION_PROBE% (literal)")
  link := filepath.Join(root, "link & ^ ! %TTSC_WINDOWS_JUNCTION_PROBE% (literal)")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(target, "sentinel.txt"), []byte("safe"), 0o644); err != nil {
    t.Fatal(err)
  }

  if err := windowsjunction.Create(link, target); err != nil {
    t.Fatal(err)
  }
  got, err := os.ReadFile(filepath.Join(link, "sentinel.txt"))
  if err != nil {
    t.Fatal(err)
  }
  if string(got) != "safe" {
    t.Fatalf("junction read %q, want safe", got)
  }
  expanded := strings.ReplaceAll(link, "%TTSC_WINDOWS_JUNCTION_PROBE%", "expanded")
  if _, err := os.Lstat(expanded); !os.IsNotExist(err) {
    t.Fatalf("cmd.exe expanded a percent sequence into %s: %v", expanded, err)
  }
}
