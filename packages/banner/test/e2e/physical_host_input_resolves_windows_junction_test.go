//go:build e2e

package banner_test

import (
  "os"
  "path/filepath"
  "runtime"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestPhysicalHostInputResolvesWindowsJunction verifies JSON config identity
// proof uses the same physical file that Node's native realpath observes.
//
// @evidence contracts/testing.md#behavioral-verification The banner physicalHostInput helper receives a config through a real Windows junction and must return a nonnil canonical path equal to the physical target.
// @evidence contracts/testing.md#independent-expectations filepath.EvalSymlinks on the target is the independently observed filesystem oracle; no config contents or product-returned expectation are reused.
// @evidence contracts/testing.md#distinguishing-cases The file spelling crosses a directory junction; missing/cyclic links are not covered here. The entire entry skips on non-Windows.
// @evidence contracts/testing.md#execution-ownership The named Go entry calls the banner helper in-process through its test bridge and creates a real Windows junction. It starts no native sidecar or evaluator.
// @evidence contracts/e2e.md#necessary-boundary The OS junction-to-physical-file connection is real. The helper semantics are in-process, and an E2E label cannot establish this Windows-only assertion on Linux.
// @evidence contracts/e2e.md#shared-execution One target directory, one config file and one junction are created under t.TempDir; windowsjunction.Create is the only process started (cmd.exe mklink). No plugin build or project load occurs.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity t.TempDir owns the target, link and config file; no artifact cache or global override is retained.
// @evidence contracts/e2e.md#preserved-coverage The body asserts one non-nil physical path equal to EvalSymlinks of the target file after resolving through a junction directory; on non-Windows it skips, so nothing is asserted there.
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
  file := filepath.Join(target, "banner.config.json")
  if err := os.WriteFile(file, []byte(`{"text":"safe"}`), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := windowsjunction.Create(link, target); err != nil {
    t.Fatal(err)
  }

  got := bannerPhysicalHostInput(filepath.Join(link, filepath.Base(file)))
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
