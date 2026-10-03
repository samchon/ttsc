package evidence

import (
  "strings"
  "testing"
)

/**
 * TestEvidenceSemanticGraphMaterializesAmbientNamespaceMembers verifies graph materializes ambient namespace members.
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
 * @evidence contracts/testing.md#distinguishing-cases Implicitly exported ambient types, callables, values and a nested namespace must be covered by the cited namespace scope.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphMaterializesAmbientNamespaceMembers is a selectable native Go unit entry. runIndexRule writes the authored modules (including a .d.ts) to a temp root, parses them with the TypeScript parser shim and calls graphRule.Check in-process, three times (full fixture, original appended control, then with the namespace citation removed); independent named subcases preserve later observations after another subcase fails; no consumer install, native plugin build or product process is launched.
 */
func TestEvidenceSemanticGraphMaterializesAmbientNamespaceMembers(t *testing.T) {
  files := map[string]string{
    "src/contracts.d.ts": "export namespace Ambient {\n  interface Input { id: string; }\n  function run(input: Input): void;\n  const state: string;\n  namespace Nested {\n    function work(): void;\n  }\n}\n",
    "src/use.ts":         "import { Ambient } from \"./contracts.js\";\n\nconst input: Ambient.Input = { id: \"member\" };\nAmbient.run(input);\nAmbient.Nested.work();\nexport const state: string = Ambient.state;\n",
    "src/claim.ts":       "import type { Ambient } from \"./contracts.js\";\n\n/** @evidence {@link Ambient} Documents the complete ambient namespace contract. */\nexport interface IClaim {}\n",
  }
  config := "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/claim.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/contracts.d.ts\"],\"symbol\":[\"type\",\"function\",\"property\"]}}]}"
  t.Run("original", func(t *testing.T) {
    messages := runIndexRule(t, files, config)
    if len(messages) != 0 {
      t.Fatalf("the complete original declaration fixture must have no finding: %v", messages)
    }
  })
  originalContracts := files["src/contracts.d.ts"]
  files["src/contracts.d.ts"] += "\nexport interface BoundaryAmbientUncited {}\n"
  t.Run("uncited_control", func(t *testing.T) {
    control := runIndexRule(t, files, config)
    if len(control) != 1 || !strings.Contains(control[0], "Missing acknowledgement for 'BoundaryAmbientUncited'") {
      t.Fatalf("the original uncited declaration control must be the only finding: %v", control)
    }
  })
  files["src/contracts.d.ts"] = originalContracts
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], "/** @evidence {@link Ambient} Documents the complete ambient namespace contract. */", "", 1)
  t.Run("citation_removed", func(t *testing.T) {
    missing := runIndexRule(t, files, config)
    assertProblemContains(t, missing, "Missing acknowledgement for 'Ambient.Input'")
  })

}
