package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a chain past the resolver is refused on an ancestor of the root too.
 *
 * The twin of the case above, one component further up, and the shape that
 * makes the refusal worth having: the declared root itself is an ordinary
 * directory, so every stat of it answers directory and the leaf tells nobody
 * that the path reaching it is still a link. The filesystem opens it anyway,
 * the Program spells its sources through the other side, and the claim
 * deactivates in silence, which is what asking every component, rather than
 * only the last, is for.
 *
 *  1. Build a chain longer than the resolver follows onto the workspace.
 *  2. Root a TypeScript claim at a real directory inside the chain's head.
 *  3. Assert the root is refused rather than selecting nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn refuses an overlong link chain in a TypeScript root ancestor.
 * @evidence contracts/testing.md#independent-expectations Literal declared root and passes-through chain wording are authored diagnostic expectations.
 * @evidence contracts/testing.md#distinguishing-cases The leaf itself is an ordinary directory but an ancestor exceeds the bounded resolution policy.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkChainAboveARootIsRefusedForTypeScriptToo(t *testing.T) {
	workspace := t.TempDir()
	project := filepath.Join(workspace, "project")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	previous := workspace
	head := ""
	for hop := range 34 {
		head = "hop" + decimal(hop)
		link := filepath.Join(workspace, head)
		if err := linkDirectory(previous, link); err != nil {
			t.Fatalf("this platform refused to create a link: %v", err)
		}
		previous = link
	}
	declared := "../" + head + "/project"
	if _, err := os.Stat(filepath.Join(workspace, head, "project")); err != nil {
		t.Fatalf(
			"this platform did not follow the chain to a directory either (%v), so the stat gate answers first",
			err,
		)
	}
	messages := runRootedGraphIn(t, workspace, map[string]string{
		"project/docs/pricing.md": "## Discounts {#discounts}\n",
		"project/src/sale.ts":     "export interface ISale {}\n",
	}, `{"claims":[{
    "type":"typescript",
    "root":"`+declared+`",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
	assertProblemContains(
		t,
		messages,
		"found no directory at the end of the typescript root '"+declared+"'",
	)
	// The sentence was written for a chain at the root and reports one above it
	// too, so it says the path passes through a chain rather than that it is one.
	assertProblemContains(
		t,
		messages,
		"passes through a chain of links longer than this rule follows",
	)
}
