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
 * The portable helper uses `os.Symlink`; an explicit Windows junction is needed where
 * the process lacks the privilege, so an elevated Windows runner would exercise
 * symbolic links on both lanes and leave the junction handling proven nowhere.
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
 * @evidence contracts/testing.md#execution-ownership This named case shares the existing Windows kernel Go process and previously installed candidate SDK; it creates an actual junction through the explicit OS fixture helper, with no per-case native compilation or SDK installation.
 * @evidence contracts/e2e.md#necessary-boundary Actual Windows junction traversal cannot be established by a symbolic-link-only fixture or portable path string; the original rule graph runs over that reparse point.
 * @evidence contracts/e2e.md#shared-execution The existing kernel batch reuses the installed CLI candidate SDK and one Go test process; this case adds only its own temporary junction fixture.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity A private temporary root contains the junction and documents, so no other case supplies its population or acknowledges its heading.
 * @evidence contracts/e2e.md#preserved-coverage The original authored ISale citation and clean diagnostic assertion remain intact; portable link-root and internal-link contrasts remain separately named units.
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
