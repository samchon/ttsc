package evidence

import (
	"os"
	"path/filepath"
	"testing"
)

/**
 * Verifies a TypeScript claim rooted at a link keeps its hosts.
 *
 * This kind walks nothing, so the link asymmetry was left out of the walker
 * repair on the grounds that it had no walk. It does have a comparison: the gate
 * accepts a linked root because `os.Stat` follows it, and the Program reports
 * whatever path its tsconfig resolved, so when the two disagree every source
 * fails the match, the claim selects nothing, and it deactivates without a word.
 * Measured before the repair: no diagnostic at all.
 *
 * It sits with the linked-root cases because the root is the subject, not the
 * walk, and this file's name names the repair rather than the mechanism.
 *
 *  1. Link a directory onto the project and root a TypeScript claim at the link.
 *  2. Leave its reference's selected section uncited, and give the host a tag
 *     the rule reports by position.
 *  3. Assert the claim is active, and that the position names the declared root.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn retains a linked TypeScript claim, its uncovered Markdown reference and its host location through ../mirror.
 * @evidence contracts/testing.md#independent-expectations Literal Discounts target and ../mirror/src/sale.ts identify both coverage and host position independently.
 * @evidence contracts/testing.md#distinguishing-cases The host has a malformed evidence tag so its location is observable independently of the Markdown target.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkedTypeScriptClaimRootKeepsItsHosts(t *testing.T) {
	workspace := t.TempDir()
	project := filepath.Join(workspace, "project")
	if err := os.MkdirAll(project, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := linkDirectory(project, filepath.Join(workspace, "mirror")); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	messages := runRootedGraphIn(t, workspace, map[string]string{
		"project/docs/pricing.md": "## Discounts {#discounts}\n",
		"project/src/sale.ts":     "/** @evidence */\nexport interface ISale {}\n",
	}, `{"claims":[{
    "type":"typescript",
    "root":"../mirror",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
	assertProblemContains(
		t,
		messages,
		"Missing acknowledgement for 'docs/pricing.md#discounts'",
	)
	// The target above belongs to the default Markdown base, so it would survive a
	// repair that composed the TypeScript address from the resolved directory. A
	// location naming the host file is the half that would not, which is why the
	// source carries a tag the rule has to report by position.
	assertProblemContains(t, messages, "../mirror/src/sale.ts")
}
