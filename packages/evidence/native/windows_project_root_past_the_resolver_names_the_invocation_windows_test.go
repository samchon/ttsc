//go:build windows

package evidence

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

/**
 * Verify the unresolved project root names the invocation repair and never a nonexistent root property across an actual Windows junction chain.
 *
 * @evidence contracts/testing.md#behavioral-verification Builds thirty-four real junctions and drives the authored rule graph; the unresolved project root names the invocation repair and never a nonexistent root property.
 * @evidence contracts/testing.md#independent-expectations Original literal diagnostic text and explicit absence of the opposing diagnostic determine success; host resolution results never supply the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases The chain exceeds the bounded resolver while os.Stat can still reach the target. This contrasts an unresolved declared population root with a usable implicit Program base, retaining all original assertions.
 * @evidence contracts/testing.md#execution-ownership The existing Windows kernel batch executes this case against the previously installed candidate SDK. Fixture junction creation is an actual Windows process boundary; no per-case compiler or SDK installation is added.
 * @evidence contracts/e2e.md#shared-execution The existing installed CLI candidate is shared by the Windows kernel batch; this test creates only its junction fixture and directly invokes rule semantics in that one Go test process.
 * @evidence contracts/e2e.md#necessary-boundary The actual Windows filesystem, candidate SDK and authored rule graph are sufficient for this junction comparison. No bundler, LSP or additional consumer is started.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The shared installed candidate SDK is immutable for this batch. Each case owns its t.TempDir, source files, junction chain and local rule graph; t.TempDir removes the fixture after execution. These TypeScript and Markdown cases do not load or mutate Prisma or Swagger decoder caches.
 * @evidence contracts/e2e.md#preserved-coverage TestWindowsProjectRootPastTheResolverNamesTheInvocation preserves TestAProjectRootPastTheResolverIsNotToldToCorrectARoot's literal positive diagnostics and absence of the opposing diagnostic across the same thirty-four-hop fixture, replacing only symbolic-link creation with actual Windows junction creation. The original portable entry remains in Linux units.
 */
func TestWindowsProjectRootPastTheResolverNamesTheInvocation(t *testing.T) {
	workspace := t.TempDir()
	real := filepath.Join(workspace, "real")
	if err := os.MkdirAll(real, 0o755); err != nil {
		t.Fatal(err)
	}
	previous := real
	for hop := range 34 {
		link := filepath.Join(workspace, "hop"+decimal(hop))
		if err := linkWindowsPopulationDirectory(previous, link); err != nil {
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
