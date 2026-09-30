package evidence

import (
  "encoding/json"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies rooted code references declare future export dependencies.
 *
 * Project inputs are published before the Program loads. Watching the root
 * keeps a newly created re-export module observable even outside entry globs.
 *
 * 1. Configure a rooted TypeScript reference and a Markdown claim.
 * 2. Inspect the configured external topology without loading sources.
 * 3. Reject a root/package combination instead of silently choosing a base.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.DeclareInputs and decodeGraphConfig exercises this case. Verifies rooted code references declare future export dependencies.
 *
 * @evidence contracts/testing.md#independent-expectations Explicit reference roots publish ../api/** beside review.md, while combining root and package is an invalid configuration. Both expected values are authored independently of normalization.
 *
 * @evidence contracts/testing.md#distinguishing-cases Configure a rooted TypeScript reference and a Markdown claim. Inspect the configured external topology without loading sources. Reject a root/package combination instead of silently choosing a base.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksDeclareExternalTopology is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.DeclareInputs and decodeGraphConfig in the native Go process. It consumes authored strings or parsed source nodes directly; no installed consumer, compiled host, or loader process participates.
 */
func TestFileLinksDeclareExternalTopology(t *testing.T) {
  config := `{"claims":[{"type":"markdown","files":["review.md"],"reference":{"type":"typescript","root":"../api","files":["src/index.ts"]}}]}`
  assertDeclares(t, declaredInputs(t, config), rule.ProjectInputGlob, []string{"review.md", "../api/**"})
  _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"reference":{"type":"typescript","root":"../api","package":"sdk","files":["*.ts"]}}]}`))
  assertProblemContains(t, problems, "cannot be combined")
}
