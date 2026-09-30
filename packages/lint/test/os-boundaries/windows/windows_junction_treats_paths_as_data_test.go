//go:build windows

package linthost

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// @evidence contracts/testing.md#behavioral-verification windowsjunction.Create creates a real link whose sentinel reads safe and whose literal percent sequence does not create an environment-expanded alternate path.
// @evidence contracts/testing.md#independent-expectations The authored sentinel safe and literal metacharacter paths independently require exact content and absence of the expanded spelling.
// @evidence contracts/testing.md#distinguishing-cases Owns ampersand, caret, exclamation, percent and parentheses in actual junction paths, contrasting the literal link with the environment-expanded alternate; ordinary junction fingerprinting has its separate kernel case.
// @evidence contracts/testing.md#execution-ownership TestWindowsJunctionTreatsPathsAsData is selected once from os-boundaries/windows by the existing setup Windows Go batch; a Windows build constraint prevents Linux skip entries.
// @evidence contracts/e2e.md#necessary-boundary Real Windows reparse creation and reads detect command interpretation of path data that a portable unit cannot execute.
// @evidence contracts/e2e.md#shared-execution Reuses the already installed candidate SDK, flattened Go harness and Windows setup process with the other kernel entries; only its tiny filesystem fixture is private.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns target and link and t.Setenv restores the deliberately conflicting variable; no cached producer, project state or host session is replaced.
// @evidence contracts/e2e.md#preserved-coverage Keeps real junction creation, sentinel equality and absent expanded path exactly; build-time Windows ownership replaces only the former non-Windows skip.
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
