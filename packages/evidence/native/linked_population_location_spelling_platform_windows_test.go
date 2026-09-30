//go:build windows

package evidence

import (
	"testing"
)

/**
 * Verifies a location is spelled the way a reader opens it, in every base shape.
 *
 * The guide promises this and had promised something narrower three times: that
 * a location stays project-relative, which two reachable roots deny. A root on
 * another Windows volume and a UNC share have no relative spelling from a
 * drive-letter project, so `filepath.Rel` refuses and the absolute path is what
 * a reader opens. Pinning the shapes is what keeps the sentence honest.
 *
 *  1. Resolve a root inside the project, one above it, one absolute on the same
 *     volume, one on another volume, a bare drive root, and a UNC share.
 *  2. Compose a location under each.
 *  3. Assert the first three are project-relative and the rest are not.
 *
 * @evidence contracts/testing.md#behavioral-verification resolvePopulationBase and display preserve authored root spelling across six Windows path shapes.
 * @evidence contracts/testing.md#independent-expectations Six literal locations and unchanged declared roots are independent display expectations.
 * @evidence contracts/testing.md#distinguishing-cases In-project, ascending and same-volume paths contrast with different-volume roots, a bare drive root and a UNC share.
 * @evidence contracts/testing.md#execution-ownership This named Windows native-policy case invokes authored filepath and display operations in the existing installed-SDK Go batch. Fictional drive and UNC strings are inputs; no drive, share, native compiler or product host is created.
 * @evidence contracts/e2e.md#necessary-boundary The owning operation delegates volume and UNC interpretation to Windows filepath.Rel. Running the original Windows literal table on a POSIX filepath implementation would exercise a different native policy, so this case needs the actual Windows Go host.
 * @evidence contracts/e2e.md#shared-execution The case joins the existing installed-SDK Windows Go batch and creates no consumer, drive, network share or compiler producer of its own.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity All six roots are literal hypothetical path inputs; there is no mutable filesystem population or cross-case cache to contaminate native path policy.
 * @evidence contracts/e2e.md#preserved-coverage The original six location expectations and all unchanged declared-root checks remain; POSIX spelling and real directory identity keep their separately named portable cases.
 */
func TestALocationIsSpelledTheWayAReaderOpensIt(t *testing.T) {
	project := `C:\home\me\project`
	for _, entry := range []struct {
		declared string
		expected string
	}{
		{"docs", "docs/requirements/pricing.md"},
		{"../documents", "../documents/requirements/pricing.md"},
		{"C:/contracts", "../../../contracts/requirements/pricing.md"},
		{"D:/contracts", "D:/contracts/requirements/pricing.md"},
		{"D:/", "D:/requirements/pricing.md"},
		{"//server/share", "//server/share/requirements/pricing.md"},
	} {
		base := resolvePopulationBase(project, entry.declared)
		if got := base.display("requirements/pricing.md"); got != entry.expected {
			t.Fatalf("root %q location = %q, want %q", entry.declared, got, entry.expected)
		}
		if base.Declared != entry.declared {
			t.Fatalf("root %q declared = %q", entry.declared, base.Declared)
		}
	}
}
