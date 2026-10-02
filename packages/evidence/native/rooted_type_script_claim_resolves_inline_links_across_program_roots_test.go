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
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check runs over two parsed sources (packages/api ISale, with claim root ../api, and packages/backend IContract, the unrooted reference) under a project rooted at packages/backend; ISale cites IContract through {@link IContract} and the captured reporter must receive no message.
 * @evidence contracts/testing.md#independent-expectations The expectation (no diagnostic) follows from the authored layout: the one reference unit IContract is cited by the one claim host, so a correct resolver leaves nothing unresolved or uncovered. A resolver that failed to relate the sibling-root import path to the backend root would surface an unresolved target or missing acknowledgement.
 * @evidence contracts/testing.md#distinguishing-cases Only the accepting case executes: there is no unresolvable-link twin in this entry, and the silence is meaningful only because an unresolved or uncovered unit would be reported. The config.Claims length check merely guards the helper's decoded configuration.
 * @evidence contracts/testing.md#execution-ownership TestRootedTypeScriptClaimResolvesInlineLinksAcrossProgramRoots is a selectable native Go unit entry. rootedTypeScriptProgram writes the two authored modules to a temp workspace and parses them with the TypeScript parser shim, and graphRule.Check runs in-process; no consumer, build or product host is started.
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
