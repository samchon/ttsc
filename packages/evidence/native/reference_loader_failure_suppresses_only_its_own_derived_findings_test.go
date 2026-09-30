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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification parseTypeScriptInventory exercises this case: Verifies a failed reference suppresses only its derived coverage findings. The original assertions check assert only the healthy sibling derives a missing acknowledgement.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations A loader diagnostic already says why one population is unavailable. Treating that failed inventory as a healthy empty document adds a false no-units finding and can add missing acknowledgements from a partial denominator, while suppressing every claim would hide healthy sibling obligations. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Give one claim a failed Markdown reference and a healthy sibling. Materialize and evaluate both from the same claim file. Assert only the healthy sibling derives a missing acknowledgement. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestReferenceLoaderFailureSuppressesOnlyItsOwnDerivedFindings is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls parseTypeScriptInventory within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
