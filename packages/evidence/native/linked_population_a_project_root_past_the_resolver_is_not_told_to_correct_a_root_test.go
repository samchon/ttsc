package evidence

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

/**
 * Verifies the project root itself is refused, and not told to correct a `root`.
 *
 * The default base is checked by the two walkers, and it is the one base that
 * declared no property, so the sentence written for a declared root would send
 * its author looking for a line their configuration does not contain. It is the
 * ttsc project root, so it is named as one and the repair is the invocation.
 *
 * The TypeScript gate deliberately does not ask this of the default base: a
 * Program spells its sources against the directory ttsc was invoked with, so the
 * comparison matches without any resolution and refusing would fail a population
 * that works. The refusal below therefore comes from the Markdown reference.
 *
 *  1. Build a chain longer than the resolver follows and drive the rule with it
 *     as the project root, which is a state the host's own realpath keeps
 *     production from reaching at this length.
 *  2. Read the refusal.
 *  3. Assert it names the project root and asks for the invocation, not the
 *     property.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRuleAtRoot reports the overlong project-root chain and asks to change the invocation without naming a root property.
 * @evidence contracts/testing.md#independent-expectations The literal sentences "found no directory at the end of the ttsc project root" and "Run ttsc against the directory those links end at." come from the diagnostic's authored contract, and the literal absence of "Correct the 'root' property" encodes that a base with no declared root has no property to correct.
 * @evidence contracts/testing.md#distinguishing-cases A single negative-boundary case: a 34-link chain, longer than the resolver follows, as the default project root with a Markdown reference; the body asserts both the required invocation sentence and the forbidden property sentence, and runs no declared-root or TypeScript-only counterpart.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestAProjectRootPastTheResolverIsNotToldToCorrectARoot(t *testing.T) {
	workspace := t.TempDir()
	real := filepath.Join(workspace, "real")
	if err := os.MkdirAll(real, 0o755); err != nil {
		t.Fatal(err)
	}
	previous := real
	for hop := range 34 {
		link := filepath.Join(workspace, "hop"+decimal(hop))
		if err := linkDirectory(t, previous, link); err != nil {
			t.Fatalf("this platform refused to create a link: %v", err)
		}
		previous = link
	}
	if _, err := os.Stat(previous); err != nil {
		t.Fatalf(
			"this platform did not follow the chain to a directory either (%v), so nothing reaches the refusal",
			err,
		)
	}
	messages := runIndexRuleAtRoot(t, previous, map[string]string{
		"docs/pricing.md": "## Discounts {#discounts}\n",
		"src/sale.ts":     "export interface ISale {}\n",
	}, `{"claims":[{
    "type":"typescript",
    "files":["src/**/*.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
	if len(messages) == 0 {
		logLinkedPopulationPaths(t, previous)
	}
	assertProblemContains(t, messages, "found no directory at the end of the ttsc project root")
	assertProblemContains(t, messages, "Run ttsc against the directory those links end at.")
	if countProblemsContaining(messages, "Correct the 'root' property") != 0 {
		t.Fatalf(
			"the base that declared no root has no property to correct:\n%s",
			strings.Join(messages, "\n"),
		)
	}
}
