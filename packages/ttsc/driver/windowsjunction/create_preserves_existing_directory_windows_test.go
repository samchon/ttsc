//go:build windows

package windowsjunction

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCreatePreservesExistingDirectory verifies an occupied link is rejected safely.
//
// An existing directory belongs to its caller. Junction creation must report
// failure without replacing that directory or mutating the intended target.
//
//  1. Write distinct sentinel values in the occupied link and target directories.
//  2. Attempt junction creation at the occupied link and require an error.
//  3. Read both sentinels and require their original values.
//
// @evidence contracts/testing.md#behavioral-verification Create returns an error for an occupied link and leaves both caller-owned directories' sentinel bytes intact.
// @evidence contracts/testing.md#independent-expectations Independently authored occupied and target bytes establish the preservation contract; a failed junction operation cannot replace caller-owned data.
// @evidence contracts/testing.md#distinguishing-cases This negative case owns an already-existing link location and checks both the rejected destination and untouched target; the metacharacter case owns successful creation.
// @evidence contracts/testing.md#execution-ownership Go test discovers this Windows Test entry and directly invokes the owning filesystem operation with its necessary mklink builtin, without an installed consumer, native build or product host.
func TestCreatePreservesExistingDirectory(t *testing.T) {
  root := t.TempDir()
  link := filepath.Join(root, "occupied")
  target := filepath.Join(root, "target")
  for directory, content := range map[string]string{link: "occupied", target: "target"} {
    if err := os.Mkdir(directory, 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(filepath.Join(directory, "sentinel.txt"), []byte(content), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  if err := Create(link, target); err == nil {
    t.Fatal("Create succeeded at an occupied link")
  }
  for directory, want := range map[string]string{link: "occupied", target: "target"} {
    got, err := os.ReadFile(filepath.Join(directory, "sentinel.txt"))
    if err != nil {
      t.Fatal(err)
    }
    if string(got) != want {
      t.Fatalf("%s sentinel = %q, want %q", directory, got, want)
    }
  }
}
