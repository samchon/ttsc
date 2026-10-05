//go:build windows

package evidence

import (
  "os"
  "path/filepath"
  "testing"
)

/**
 * Verifies a Windows junction is read through, not only a symbolic link.
 *
 * The shared link helper already creates a junction on Windows; this case names the
 * junction explicitly so its handling stays pinned if that helper changes.
 *
 * That handling is the whole reason `resolveLinkedDirectory` exists instead of
 * `filepath.EvalSymlinks`, which returns a junction unchanged.
 *
 *  1. Create the junction directly, without the symbolic-link preference.
 *  2. Root a Markdown reference at it.
 *  3. Assert its document materializes.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn accepts the original Discounts citation through an explicitly created Windows junction.
 * @evidence contracts/testing.md#independent-expectations The original no-diagnostics assertion defines the valid citation result; it does not separately count the target inventory.
 * @evidence contracts/testing.md#distinguishing-cases Junction creation is forced instead of preferring a symbolic link, preserving the Windows reparse-point boundary.
 * @evidence contracts/testing.md#execution-ownership TestAWindowsJunctionRootIsReadThrough is a Windows-only Go unit entry of package evidence, run by go test on a Windows host. It creates real NTFS directory junctions through linkWindowsPopulationDirectory and drives the rule in-process; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestAWindowsJunctionRootIsReadThrough(t *testing.T) {
  workspace := t.TempDir()
  target := filepath.Join(workspace, "target", "requirements")
  if err := os.MkdirAll(target, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(
    filepath.Join(target, "pricing.md"),
    []byte("## Discounts {#discounts}\n"),
    0o644,
  ); err != nil {
    t.Fatal(err)
  }
  if err := linkWindowsPopulationDirectory(filepath.Join(workspace, "target"), filepath.Join(workspace, "documents")); err != nil {
    t.Fatal(err)
  }
  messages := runRootedGraphIn(t, workspace, map[string]string{
    "project/src/sale.ts": "/** @evidence requirements/pricing.md#discounts Discount rules follow this section. */\n" +
      "export interface ISale {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{
      "type":"markdown",
      "root":"../documents",
      "files":["requirements/**/*.md"],
      "symbol":"h2"
    }
  }]}`)
  assertNoProblems(t, messages)
}
