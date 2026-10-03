package evidence

import (
  "testing"
)

/**
 * Verifies disabled references add no citation hint beside one enabled Markdown target.
 *
 * The citation-trigger list must contain exactly the live section despite staged Markdown and TypeScript references. This checks that list alone; it does not assert exclusion-trigger output.
 *
 * 1. Configure disabled Markdown and TypeScript references.
 * 2. Satisfy one enabled Markdown reference.
 * 3. Require the citation list to contain only docs/live.md#live.
 *
 * @evidence contracts/testing.md#behavioral-verification runGraphHints returns a silent graph and exactly one citation-trigger insert, docs/live.md#live, despite configured staged Markdown and TypeScript references.
 * @evidence contracts/testing.md#independent-expectations A disabled claim contributes no active reference population. The authored live target and exact singleton citation list establish the expected result independently of staged selections.
 * @evidence contracts/testing.md#distinguishing-cases A disabled claim contains both strict Markdown and TypeScript references beside one satisfied enabled Markdown claim. The assertion covers citation-trigger output only; it does not inspect exclusion-trigger routes.
 * @evidence contracts/testing.md#execution-ownership TestDisabledClaimsContributeNoHints is the Go unit entry discovered beside the native package. Its runGraphHints fixture executes Check and the simulated passing gate before Hints in the same process; it does not launch an editor, LSP host or native artifact.
 */
func TestDisabledClaimsContributeNoHints(t *testing.T) {
  hints, messages := runGraphHints(t, map[string]string{
    "docs/live.md":   "## Live Requirement {#live}\n",
    "docs/staged.md": "## Staged Requirement {#staged}\n",
    "src/live.ts": `/** @evidence docs/live.md#live Live implementation. */
export interface ILive {}
`,
    "src/staged.ts":    "export interface IStaged {}\n",
    "src/reference.ts": "export interface IReference {}\n",
  }, `{"claims":[
    {
      "type":"typescript",
      "disabled":true,
      "files":["src/staged.ts"],
      "symbol":"type",
      "reference":[
        {
          "type":"markdown",
          "files":["docs/staged.md"],
          "symbol":"h2",
          "noEvidenceExclude":true,
          "uniqueEvidence":true,
          "singleEvidencePerSymbol":true
        },
        {
          "type":"typescript",
          "files":["src/reference.ts"],
          "symbol":"type",
          "noEvidenceExclude":true
        }
      ]
    },
    {
      "type":"typescript",
      "files":["src/live.ts"],
      "symbol":"type",
      "reference":{"type":"markdown","files":["docs/live.md"],"symbol":"h2"}
    }
  ]}`)
  assertSilent(t, messages)
  cited := targetInserts(targetHintsAt(hints, "@evidence "))
  if len(cited) != 1 || cited[0] != "docs/live.md#live" {
    t.Fatalf("disabled claim leaked into hints: %v", cited)
  }
}
