package strip_test

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestPhysicalHostInputResolvesWindowsJunction verifies JSON config identity
// proof uses the same physical file that Node's native realpath observes.
// @evidence contracts/testing.md#behavioral-verification The strip physicalHostInput helper receives a config through a real Windows junction and must return a nonnil canonical path equal to the physical target.
// @evidence contracts/testing.md#independent-expectations filepath.EvalSymlinks on the target is the independently observed filesystem oracle; no config contents or product-returned expectation are reused.
// @evidence contracts/testing.md#distinguishing-cases The file spelling crosses a directory junction; missing/cyclic links are not covered here. The entire entry skips on non-Windows.
// @evidence contracts/testing.md#execution-ownership The named Go entry calls the strip helper in-process through its test bridge and creates a real Windows junction. It starts no native sidecar or evaluator.
func TestPhysicalHostInputResolvesWindowsJunction(t *testing.T) {
  if runtime.GOOS != "windows" {
    t.Skip("Windows junction boundary")
  }
  root := t.TempDir()
  target := filepath.Join(root, "target")
  link := filepath.Join(root, "link")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  file := filepath.Join(target, "strip.config.json")
  if err := os.WriteFile(file, []byte(`{"calls":[]}`), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := windowsjunction.Create(link, target); err != nil {
    t.Fatal(err)
  }

  got := stripPhysicalHostInput(filepath.Join(link, filepath.Base(file)))
  want, err := filepath.EvalSymlinks(file)
  if err != nil {
    t.Fatal(err)
  }
  if got == nil || filepath.Clean(*got) != filepath.Clean(want) {
    value := "<nil>"
    if got != nil {
      value = *got
    }
    t.Fatalf("physical host input = %q, want %q", value, want)
  }
}
