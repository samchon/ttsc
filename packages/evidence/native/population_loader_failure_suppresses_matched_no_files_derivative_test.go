package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a failed population root is not reported as a healthy glob miss.
 *
 * No file inventory exists when the walk itself cannot start, so per-file
 * health alone cannot distinguish failure from an honest empty match. The
 * population marker carries that distinction without becoming a matchable
 * artifact.
 *
 *  1. Record a Markdown population failure with no file inventories.
 *  2. Materialize a reference whose glob would otherwise match nothing.
 *  3. Assert the reference is unhealthy and emits no derived match diagnostic.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification materializeClaimStates is exercised with the scenario below; the assertions require the reference is unhealthy and emits no derived match diagnostic.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations No file inventory exists when the walk itself cannot start, so per-file health alone cannot distinguish failure from an honest empty match. The population marker carries that distinction without becoming a matchable artifact.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Record a Markdown population failure with no file inventories. Materialize a reference whose glob would otherwise match nothing. Assert the reference is unhealthy and emits no derived match diagnostic.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestPopulationLoaderFailureSuppressesMatchedNoFilesDerivative is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestPopulationLoaderFailureSuppressesMatchedNoFilesDerivative(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/claim.ts"],
    "symbol":"type",
    "reference":{"type":"markdown","files":["docs/**/*.md"],"symbol":"h2"}
  }]}`)
  markdown := map[string]*artifactInventory{}
  recordPopulationFailure(markdown, artifactMarkdown, config.Claims[0].References[0].Base)
  typescript := map[string]*artifactInventory{
    "src/claim.ts": parseTypeScriptInventory(
      t,
      "src/claim.ts",
      "export interface Claim {}\n",
    ),
  }
  loader := newTypeScriptLoader(root, typescript)
  states, messages := materializeClaimStates(
    config,
    markdown,
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    typescript,
    loader,
  )
  if states[0].References[0].Healthy {
    t.Fatal("a failed population root must keep its reference unhealthy")
  }
  if countProblemsContaining(messages, "matched no markdown files") != 0 {
    t.Fatalf("a root failure was reinterpreted as a healthy glob miss:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
}
