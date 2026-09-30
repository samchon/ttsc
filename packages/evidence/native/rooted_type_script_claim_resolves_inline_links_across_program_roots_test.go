package evidence

import (
  "encoding/json"
  "testing"
  "github.com/samchon/ttsc/packages/lint/rule"
)

/**
 * Verifies inline-link resolution keeps working when the claiming module lives
 * under a sibling TypeScript root.
 *
 * A rooted declaration is displayed as `../api/...`, while its imported module
 * may normalize back into the active backend root. Resolving both locations
 * through the physical project prevents separator and sibling-segment spelling
 * from breaking an otherwise valid citation.
 *
 *  1. Supply a rooted API claim and its imported backend contract in one Program.
 *  2. Cite the imported contract through an inline link.
 *  3. Assert the complete graph resolves without a diagnostic.
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check exercises the authored fixture. Assert the complete graph resolves without a diagnostic.
 * @evidence contracts/testing.md#independent-expectations A rooted declaration is displayed as `../api/...`, while its imported module may normalize back into the active backend root. Resolving both locations through the physical project prevents separator and sibling-segment spelling from breaking an otherwise valid citation. The authored scenario requires this outcome: Assert the complete graph resolves without a diagnostic.
 * @evidence contracts/testing.md#distinguishing-cases Supply a rooted API claim and its imported backend contract in one Program. Cite the imported contract through an inline link. Assert the complete graph resolves without a diagnostic.
 * @evidence contracts/testing.md#execution-ownership TestRootedTypeScriptClaimResolvesInlineLinksAcrossProgramRoots runs as a Go unit entry in the native package. graphRule.Check executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestRootedTypeScriptClaimResolvesInlineLinksAcrossProgramRoots(t *testing.T) {
  root, config, sources := rootedTypeScriptProgram(
    t,
    map[string]string{
      "packages/api/src/structures/ISale.ts": "import type { IContract } from \"../../../backend/src/IContract\";\n/** @evidence {@link IContract} Implements the backend contract. */\nexport interface ISale {}",
      "packages/backend/src/IContract.ts":    "export interface IContract {}",
    },
    []string{
      "packages/api/src/structures/ISale.ts",
      "packages/backend/src/IContract.ts",
    },
    `{"claims":[{
      "type":"typescript",
      "root":"../api",
      "files":["src/structures/**/*.ts"],
      "reference":{
        "type":"typescript",
        "files":["src/IContract.ts"],
        "symbol":"type"
      }
    }]}`,
  )
  reporter := &capturedProjectReporter{}
  graphRule{}.Check(rule.NewProjectContext(
    rule.ProjectIdentity{PhysicalProjectRoot: root},
    sources,
    nil,
    rule.SeverityError,
    json.RawMessage(`{"claims":[{
      "type":"typescript",
      "root":"../api",
      "files":["src/structures/**/*.ts"],
      "reference":{
        "type":"typescript",
        "files":["src/IContract.ts"],
        "symbol":"type"
      }
    }]}`),
    reporter,
  ))
  if len(config.Claims) != 1 {
    t.Fatal("test configuration lost its rooted claim")
  }
  assertNoProblems(t, reporter.messages)
}
