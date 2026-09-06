package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies a failed reference suppresses only its derived coverage findings.
 *
 * A loader diagnostic already says why one population is unavailable. Treating
 * that failed inventory as a healthy empty document adds a false no-units
 * finding and can add missing acknowledgements from a partial denominator,
 * while suppressing every claim would hide healthy sibling obligations.
 *
 *  1. Give one claim a failed Markdown reference and a healthy sibling.
 *  2. Materialize and evaluate both from the same claim file.
 *  3. Assert only the healthy sibling derives a missing acknowledgement.
 */
func TestReferenceLoaderFailureSuppressesOnlyItsOwnDerivedFindings(t *testing.T) {
  root := t.TempDir()
  config := decodeInventoryConfig(t, root, `{"claims":[{
    "type":"typescript",
    "files":["src/claim.ts"],
    "symbol":"type",
    "reference":[
      {"type":"markdown","files":["docs/broken.md"],"symbol":"h2"},
      {"type":"markdown","files":["docs/good.md"],"symbol":"h2"}
    ]
  }]}`)
  good, goodProblems := scanMarkdownInventory(
    config.Claims[0].References[1].Base.addressOf("docs/good.md"),
    "## Good\n",
  )
  if len(goodProblems) != 0 {
    t.Fatalf("healthy Markdown fixture failed to scan: %v", goodProblems)
  }
  markdown := map[string]*artifactInventory{
    "docs/broken.md": {
      Path:       "docs/broken.md",
      Type:       artifactMarkdown,
      LoadFailed: true,
      Problems: []inventoryProblem{{
        Symbol:  "*",
        Message: "direct loader failure",
      }},
    },
    "docs/good.md": good,
  }
  typescript := map[string]*artifactInventory{
    "src/claim.ts": parseTypeScriptInventory(
      t,
      "src/claim.ts",
      "/** @evidence docs/broken.md#broken The unavailable document owns this contract. */\n"+
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
  messages = append(messages, evaluateEvidenceGraph(states, loader)...)
  if states[0].References[0].Healthy || !states[0].References[1].Healthy {
    t.Fatalf("reference health was not preserved: %+v", states[0].References)
  }
  if countProblemsContaining(messages, "found no selected evidence units") != 0 {
    t.Fatalf("a failed loader was reinterpreted as an empty source:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
  if countProblemsContaining(messages, "Missing acknowledgement") != 1 {
    t.Fatalf("only the healthy obligation may derive coverage:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
  if countProblemsContaining(messages, "Unresolved evidence target") != 0 {
    t.Fatalf("a failed reference cannot prove that a declaration target is unresolved:\n%s", strings.Join(problemMessages(messages), "\n"))
  }
  assertProblemContains(t, messages, "docs/good.md#good")
}

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
