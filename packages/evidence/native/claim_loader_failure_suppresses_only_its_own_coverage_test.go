package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies an incomplete claim suppresses its coverage without silencing peers.
 *
 * Coverage requires the complete set of declarations in a claim population. If
 * one selected file cannot be read, reporting every reference unit as missing
 * is unsupported, but a separate healthy claim still has a complete numerator
 * and denominator and must continue to fail normally.
 *
 *  1. Materialize one failed and one healthy TypeScript claim inventory.
 *  2. Give each claim its own healthy Markdown reference.
 *  3. Assert only the healthy claim derives a missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification evaluateEvidenceGraph, materializeClaimStates is exercised with the scenario below; the assertions require only the healthy claim derives a missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Coverage requires the complete set of declarations in a claim population. If one selected file cannot be read, reporting every reference unit as missing is unsupported, but a separate healthy claim still has a complete numerator and denominator and must continue to fail normally.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Materialize one failed and one healthy TypeScript claim inventory. Give each claim its own healthy Markdown reference. Assert only the healthy claim derives a missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestClaimLoaderFailureSuppressesOnlyItsOwnCoverage is a Go unit entry beside the owning evidence package. The repository Go runner executes it in the native test process; fixtures and direct rule calls exercise portable operations without installing a consumer or building a producer.
 */
func TestClaimLoaderFailureSuppressesOnlyItsOwnCoverage(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[
    {
      "name":"failed",
      "type":"typescript",
      "files":["src/failed.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/failed.md"],"symbol":"h2"}
    },
    {
      "name":"healthy",
      "type":"typescript",
      "files":["src/healthy.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/healthy.md"],"symbol":"h2"}
    }
  ]}`)
  failedDoc, failedProblems := scanMarkdownInventory(
    config.Claims[0].References[0].Base.addressOf("docs/failed.md"),
    "## Failed\n",
  )
  healthyDoc, healthyProblems := scanMarkdownInventory(
    config.Claims[1].References[0].Base.addressOf("docs/healthy.md"),
    "## Healthy\n",
  )
  if len(failedProblems)+len(healthyProblems) != 0 {
    t.Fatalf("Markdown fixtures failed to scan: %v %v", failedProblems, healthyProblems)
  }
  typescript := map[string]*artifactInventory{
    "src/failed.ts": {
      Path:       "src/failed.ts",
      Type:       artifactTypeScript,
      LoadFailed: true,
    },
    "src/healthy.ts": parseTypeScriptInventory(
      t,
      "src/healthy.ts",
      "export interface Healthy {}\n",
    ),
  }
  loader := newTypeScriptLoader(root, typescript)
  states, messages := materializeClaimStates(
    config,
    map[string]*artifactInventory{
      "docs/failed.md":  failedDoc,
      "docs/healthy.md": healthyDoc,
    },
    map[string]*artifactInventory{},
    map[string]*artifactInventory{},
    typescript,
    loader,
  )
  messages = append(messages, evaluateEvidenceGraph(states, loader)...)
  if states[0].Healthy || !states[1].Healthy {
    t.Fatalf("claim health was not preserved: %+v", states)
  }
  if countProblemsContaining(messages, "Missing acknowledgement") != 1 {
    t.Fatalf("only the healthy claim may derive coverage:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "Claim 2 ('healthy')")
}
