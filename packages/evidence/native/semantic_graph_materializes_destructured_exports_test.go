package evidence

import (
  "strings"
  "testing"
)

/**
 * TestEvidenceSemanticGraphMaterializesDestructuredExports verifies graph materializes destructured exports.
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
 * @evidence contracts/testing.md#distinguishing-cases Object shorthand, renamed, nested and rest leaves, array and rest leaves, and an export alias must resolve; private bindings must not add obligations.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphMaterializesDestructuredExports is a selectable native Go unit entry. runIndexRule writes the authored modules to a temp root, parses them with the TypeScript parser shim and calls graphRule.Check in-process, three times (full fixture, original appended control, then with the 'state' citation removed); independent named subcases preserve later observations after another subcase fails; no consumer install, native plugin build or product process is launched.
 */
func TestEvidenceSemanticGraphMaterializesDestructuredExports(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": "const source = {\n  state: \"ready\",\n  count: 1,\n  nested: { enabled: true },\n  extra: \"value\",\n};\nconst values = [1, 2, 3];\n\nexport const {\n  state,\n  count: publicCount,\n  nested: { enabled },\n  ...remaining\n} = source;\nexport const [first, , ...tail] = values;\nconst { extra: local } = source;\nexport { local as publicLocal };\nconst { state: hidden } = source;\n",
    "src/use.ts":       "import {\n  enabled,\n  first,\n  publicCount,\n  publicLocal,\n  remaining,\n  state,\n  tail,\n} from \"./contracts.js\";\n\nexport const observed = {\n  enabled,\n  first,\n  publicCount,\n  publicLocal,\n  remaining,\n  state,\n  tail,\n};\n",
    "src/claim.ts":     "import type { enabled, first, publicCount, publicLocal, remaining, state, tail } from \"./contracts.js\";\n\n/**\n * @evidence {@link state} Documents the shorthand binding.\n * @evidence {@link publicCount} Documents the renamed binding.\n * @evidence {@link enabled} Documents the nested binding.\n * @evidence {@link remaining} Documents the object rest binding.\n * @evidence {@link first} Documents the array binding.\n * @evidence {@link tail} Documents the array rest binding.\n * @evidence {@link publicLocal} Documents the export-list alias.\n */\nexport interface IClaim {}\n",
  }
  config := "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/claim.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/contracts.ts\"],\"symbol\":\"property\"}}]}"
  t.Run("original", func(t *testing.T) {
    messages := runIndexRule(t, files, config)
    if len(messages) != 0 {
      t.Fatalf("the complete original declaration fixture must have no finding: %v", messages)
    }
  })
  originalContracts := files["src/contracts.ts"]
  files["src/contracts.ts"] += "\nexport const boundaryDestructuredUncited = 0;\n"
  t.Run("uncited_control", func(t *testing.T) {
    control := runIndexRule(t, files, config)
    if len(control) != 1 || !strings.Contains(control[0], "Missing acknowledgement for 'boundaryDestructuredUncited'") {
      t.Fatalf("the original uncited declaration control must be the only finding: %v", control)
    }
  })
  files["src/contracts.ts"] = originalContracts
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], " * @evidence {@link state} Documents the shorthand binding.\n", "", 1)
  t.Run("citation_removed", func(t *testing.T) {
    missing := runIndexRule(t, files, config)
    assertProblemContains(t, missing, "Missing acknowledgement for 'state'")
  })

}
