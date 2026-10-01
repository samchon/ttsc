package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a TypeScript claim rooted inside a linked directory keeps its hosts.
 *
 * The link is on an ancestor of the declared root rather than on the root, which
 * `os.Lstat` of the leaf cannot see: it reports a directory, because traversal
 * through a link is transparent. Nothing resolved it, the Program spelled its
 * sources the other way, every comparison failed, and the claim deactivated
 * without a word. Measured before the repair: no diagnostic at all.
 *
 * This is the shape a package manager installs. The workspace dependency is the
 * link and the root an author declares is a directory inside it.
 *
 *  1. Link a directory onto the workspace and root a claim at a path inside it.
 *  2. Leave the reference's selected section uncited.
 *  3. Assert the claim is active and its host is named through the declared root.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn keeps a TypeScript population whose linked ancestor precedes the declared root leaf.
 * @evidence contracts/testing.md#independent-expectations Literal missing Discounts reference and ../mirror/project/src/sale.ts pin coverage and authored host spelling.
 * @evidence contracts/testing.md#distinguishing-cases One positive case: the link sits on an ancestor of the declared root (../mirror/project), not on the root leaf, and the claim must still be active; the body runs no leaf-link or unlinked counterpart.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestATypeScriptClaimRootedInsideALinkKeepsItsHosts(t *testing.T) {
	workspace := t.TempDir()
	project := filepath.Join(workspace, "project")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := linkDirectory(workspace, filepath.Join(workspace, "mirror")); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	messages := runRootedGraphIn(t, workspace, map[string]string{
		"project/docs/pricing.md": "## Discounts {#discounts}\n",
		"project/src/sale.ts":     "/** @evidence */\nexport interface ISale {}\n",
	}, `{"claims":[{
    "type":"typescript",
    "root":"../mirror/project",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
	assertProblemContains(
		t,
		messages,
		"Missing acknowledgement for 'docs/pricing.md#discounts'",
	)
	assertProblemContains(t, messages, "../mirror/project/src/sale.ts")
}
