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
 * @evidence contracts/testing.md#behavioral-verification graphRule.ProjectInputs and decodeGraphConfig exercises this case. Verifies rooted code references declare future export dependencies.
 *
 * @evidence contracts/testing.md#independent-expectations Explicit reference roots publish ../api/** beside review.md, while combining root and package is an invalid configuration. Both expected values are authored independently of normalization.
 *
 * @evidence contracts/testing.md#behavioral-verification declaredInputs on a Markdown claim (review.md) with a TypeScript reference rooted at `../api` over src/index.ts must declare the glob inputs exactly `review.md` and `../api/**`; decodeGraphConfig on the same reference with both `root` and `package` must produce a problem containing `cannot be combined`.
 * @evidence contracts/testing.md#independent-expectations Both expectations are authored literals: a rooted code reference must watch its root so a newly created re-export module is observable outside the entry globs, and root with package is an invalid configuration rather than a silent choice of base.
 * @evidence contracts/testing.md#distinguishing-cases One valid rooted configuration (input set compared exactly) and one invalid root-plus-package combination; neither loads sources.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksDeclareExternalTopology is a Go unit entry in the native test process; it calls ProjectInputs and decodeGraphConfig on in-memory strings with no filesystem, consumer install or product host.
 */
func TestFileLinksDeclareExternalTopology(t *testing.T) {
  config := `{"claims":[{"type":"markdown","files":["review.md"],"reference":{"type":"typescript","root":"../api","files":["src/index.ts"]}}]}`
  assertDeclares(t, declaredInputs(t, config), rule.ProjectInputGlob, []string{"review.md", "../api/**"})
  _, problems := decodeGraphConfig(json.RawMessage(`{"claims":[{"type":"markdown","files":["review.md"],"reference":{"type":"typescript","root":"../api","package":"sdk","files":["*.ts"]}}]}`))
  assertProblemContains(t, problems, "cannot be combined")
}
