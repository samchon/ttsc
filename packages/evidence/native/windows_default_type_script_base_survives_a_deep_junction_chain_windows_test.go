//go:build windows

package evidence

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

/**
 * Verify the default TypeScript base still reports the independently named missing ISpec acknowledgement without a root refusal across an actual Windows junction chain.
 *
 * @evidence contracts/testing.md#behavioral-verification Builds thirty-four real junctions and drives the authored rule graph; the default TypeScript base still reports the independently named missing ISpec acknowledgement without a root refusal.
 * @evidence contracts/testing.md#independent-expectations Original literal diagnostic text and explicit absence of the opposing diagnostic determine success; host resolution results never supply the expected answer.
 * @evidence contracts/testing.md#distinguishing-cases The chain exceeds the bounded resolver while os.Stat can still reach the target. This contrasts an unresolved declared population root with a usable implicit Program base, retaining all original assertions.
 * @evidence contracts/testing.md#execution-ownership TestWindowsDefaultTypeScriptBaseSurvivesADeepJunctionChain is a Windows-only Go unit entry of package evidence, run by go test on a Windows host. It creates real NTFS directory junctions through linkWindowsPopulationDirectory and drives the rule in-process; it starts no ttsc check, lint sidecar or installed consumer.
 */
func TestWindowsDefaultTypeScriptBaseSurvivesADeepJunctionChain(t *testing.T) {
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
			"this platform did not follow the chain to a directory either (%v), so nothing reaches the gate",
			err,
		)
	}
	messages := runIndexRuleAtRoot(t, previous, map[string]string{
		"src/sale.ts": "export interface ISale {}\n",
		"src/spec.ts": "export interface ISpec {}\n",
	}, `{"claims":[{
    "type":"typescript",
    "files":["src/sale.ts"],
    "symbol":"type",
    "reference":{"type":"typescript","files":["src/spec.ts"],"symbol":"type"}
  }]}`)
	if len(messages) == 0 {
		logLinkedPopulationPaths(t, previous)
	}
	assertProblemContains(t, messages, "Missing acknowledgement for 'ISpec'")
	if countProblemsContaining(messages, "found no directory at the end of") != 0 {
		t.Fatalf(
			"the base a Program spells its sources against owes no resolution:\n%s",
			strings.Join(messages, "\n"),
		)
	}
}
