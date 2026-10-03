package evidence

import (
  "strings"
  "testing"
)

/**
 * TestEvidenceSemanticGraphExcludesAutoAccessors verifies graph excludes auto accessors.
 *
 * This unit alone owns the transferred declaration literals and their actual
 * parser and graph-rule assertions. The retained
 * case_evidence_file_rules_share_one_consumer_check exercises a separate
 * canonical corpus for public typed configuration and compiler transport.
 *
 * 1. Materialize the unchanged original declaration and claim files.
 * 2. Evaluate the original claim and reference options.
 * 3. Require no finding, then append the original uncited declaration control and require exactly its literal finding.
 * 4. Remove one citation and require its missing obligation so an inactive population cannot pass.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates the original graph with no findings, requires exactly the authored appended control, restores the source, then requires the independently named missing obligation after removing one citation.
 * @evidence contracts/testing.md#independent-expectations The supported public declaration identities are cited explicitly; the silent original fixture contrasts the original appended uncited declaration and a removed citation, with independently named findings, so an empty or inactive population cannot pass.
 * @evidence contracts/testing.md#distinguishing-cases Ordinary instance/static callable fields are cited while adjacent callable auto-accessors must not become obligations.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphExcludesAutoAccessors is a selectable native Go unit entry. runIndexRule writes the two authored TypeScript modules to a temp root, parses them with the TypeScript parser shim and calls graphRule.Check in-process, three times (full fixture, original appended control and one citation removed); independent named subcases preserve later observations after another subcase fails; no consumer install, native plugin build or product process is launched.
 */
func TestEvidenceSemanticGraphExcludesAutoAccessors(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": "export class Service {\n  handler = (): void => {};\n  static factory: () => void;\n  accessor callback = (): void => {};\n  static accessor provider: () => void;\n}\n",
    "src/claim.ts":     "import type { Service } from \"./contracts.js\";\n\n/**\n * @evidence {@link Service.prototype.handler} Documents the callable instance field.\n * @evidence {@link Service.factory} Documents the callable static field.\n */\nexport interface IClaim {}\n",
  }
  config := "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/claim.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/contracts.ts\"],\"symbol\":\"function\"}}]}"
  t.Run("original", func(t *testing.T) {
    messages := runIndexRule(t, files, config)
    if len(messages) != 0 {
      t.Fatalf("the complete original declaration fixture must have no finding: %v", messages)
    }
  })
  originalContracts := files["src/contracts.ts"]
  files["src/contracts.ts"] += "\nexport function boundaryAccessorUncited(): void {}\n"
  t.Run("uncited_control", func(t *testing.T) {
    control := runIndexRule(t, files, config)
    if len(control) != 1 || !strings.Contains(control[0], "Missing acknowledgement for 'boundaryAccessorUncited'") {
      t.Fatalf("the original uncited declaration control must be the only finding: %v", control)
    }
  })
  files["src/contracts.ts"] = originalContracts
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], " * @evidence {@link Service.prototype.handler} Documents the callable instance field.\n", "", 1)
  t.Run("citation_removed", func(t *testing.T) {
    missing := runIndexRule(t, files, config)
    assertProblemContains(t, missing, "Missing acknowledgement for 'Service.prototype.handler'")
  })

}
