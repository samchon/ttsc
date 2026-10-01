package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph materializes destructured exports.
 *
 * The original consumer declaration inputs execute the actual parser and graph
 * rule in this process; their shared compiler and typed-config boundary remains
 * in test_evidence_file_rules_share_one_consumer_check.
 *
 * 1. Materialize the unchanged original declaration and claim files.
 * 2. Evaluate the original claim and reference options.
 * 3. Require no rule diagnostic, preserving every original silent boundary.
 * 4. Remove one citation and require its missing obligation so an inactive population cannot pass.
 *
 * @evidence contracts/testing.md#behavioral-verification runIndexRule evaluates the actual graph rule and rejects any diagnostic for the unchanged fixture, then requires the independently named missing obligation after removing one citation.
 * @evidence contracts/testing.md#independent-expectations The supported public declaration identities are cited explicitly; the silent original fixture contrasts a literal missing obligation after removing its citation, so an empty or inactive population cannot pass.
 * @evidence contracts/testing.md#distinguishing-cases Object shorthand, renamed, nested and rest leaves, array and rest leaves, and an export alias must resolve; private bindings must not add obligations.
 * @evidence contracts/testing.md#execution-ownership This named Go unit is overlaid into the evidence package and runs in the shared semantic test process; no consumer install, native plugin build or product process is launched.
 */
func TestEvidenceSemanticGraphMaterializesDestructuredExports(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": "const source = {\n  state: \"ready\",\n  count: 1,\n  nested: { enabled: true },\n  extra: \"value\",\n};\nconst values = [1, 2, 3];\n\nexport const {\n  state,\n  count: publicCount,\n  nested: { enabled },\n  ...remaining\n} = source;\nexport const [first, , ...tail] = values;\nconst { extra: local } = source;\nexport { local as publicLocal };\nconst { state: hidden } = source;\n",
    "src/use.ts": "import {\n  enabled,\n  first,\n  publicCount,\n  publicLocal,\n  remaining,\n  state,\n  tail,\n} from \"./contracts.js\";\n\nexport const observed = {\n  enabled,\n  first,\n  publicCount,\n  publicLocal,\n  remaining,\n  state,\n  tail,\n};\n",
    "src/claim.ts": "import type { enabled, first, publicCount, publicLocal, remaining, state, tail } from \"./contracts.js\";\n\n/**\n * @evidence {@link state} Documents the shorthand binding.\n * @evidence {@link publicCount} Documents the renamed binding.\n * @evidence {@link enabled} Documents the nested binding.\n * @evidence {@link remaining} Documents the object rest binding.\n * @evidence {@link first} Documents the array binding.\n * @evidence {@link tail} Documents the array rest binding.\n * @evidence {@link publicLocal} Documents the export-list alias.\n */\nexport interface IClaim {}\n",
  }
  config := "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/claim.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/contracts.ts\"],\"symbol\":\"property\"}}]}"
  messages := runIndexRule(t, files, config)
  if len(messages) != 0 {
    t.Fatalf("the complete original declaration fixture must have no finding: %v", messages)
  }
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], " * @evidence {@link state} Documents the shorthand binding.\n", "", 1)
  missing := runIndexRule(t, files, config)
  assertProblemContains(t, missing, "Missing acknowledgement for 'state'")
}
