package evidence

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

/**
 * Verifies a link chain the resolver stops following is reported, not walked.
 *
 * The resolver gives up after a fixed number of hops and returns the link it
 * stopped on, while the stat that accepts the root follows further than that on
 * Linux and on Windows. A long enough chain therefore passed the gate and then
 * walked a link, which is exactly the silence following a link at all exists to
 * remove, reappearing past the bound. Nobody writes a chain this long; the class
 * is what has to be sealed.
 *
 * A host that stops following at the same bound cannot establish this case.
 * Its fixture precondition fails rather than treating that platform limitation
 * as a passing or skipped assertion; the Linux unit lane must reach the target.
 *
 *  1. Build a chain of 35 links, past the 32 the resolver follows.
 *  2. Require the host to follow the chain; failure is a fixture failure.
 *  3. Root a reference at its head, run the rule, and assert the root is named
 *     with no glob diagnostic derived from it.
 *
 * @evidence contracts/testing.md#behavioral-verification runRootedGraphIn refuses a Markdown root reached through thirty-five links and suppresses the derivative empty-population diagnostic.
 * @evidence contracts/testing.md#independent-expectations Literal refused root and chain wording with absence of matched-no-files distinguish failure from emptiness.
 * @evidence contracts/testing.md#distinguishing-cases The host can stat the target while the owning resolver deliberately stops before completing the chain.
 * @evidence contracts/testing.md#execution-ownership This named Go unit calls authored rule/resolver operations in one Go test process with native filesystem fixtures, without installing a consumer, compiling a native artifact or launching a product host. Symbolic-link creation uses os.Symlink; unsupported local privileges fail instead of skipping.
 */
func TestALinkChainBeyondTheResolverIsReportedNotWalked(t *testing.T) {
	workspace := t.TempDir()
	target := filepath.Join(workspace, "target")
	if err := os.MkdirAll(filepath.Join(target, "requirements"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(target, "requirements", "pricing.md"),
		[]byte("## Discounts {#discounts}\n"),
		0o644,
	); err != nil {
		t.Fatal(err)
	}
	previous := target
	for hop := range 34 {
		link := filepath.Join(workspace, "hop"+decimal(hop))
		if err := linkDirectory(previous, link); err != nil {
			t.Fatalf("this platform refused to create a link: %v", err)
		}
		previous = link
	}
	documents := filepath.Join(workspace, "documents")
	if err := linkDirectory(previous, documents); err != nil {
		t.Fatalf("this platform refused to create a link: %v", err)
	}
	if _, err := os.Stat(documents); err != nil {
		t.Fatalf(
			"this platform did not follow the chain to a directory either (%v), so the root gate answers before the walk root can",
			err,
		)
	}
	messages := runRootedGraphIn(t, workspace, map[string]string{
		"project/src/sale.ts": "export interface ISale {}\n",
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
	assertProblemContains(
		t,
		messages,
		"found no directory at the end of the markdown root '../documents'",
	)
	assertProblemContains(t, messages, "a chain of links longer than this rule follows")
	if countProblemsContaining(messages, "matched no markdown files") != 0 {
		t.Fatalf(
			"a root the walk never reached is a failed population, not an empty one:\n%s",
			strings.Join(messages, "\n"),
		)
	}
}
