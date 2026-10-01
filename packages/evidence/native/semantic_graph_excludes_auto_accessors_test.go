package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph excludes auto accessors.
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
 * @evidence contracts/testing.md#distinguishing-cases Ordinary instance/static callable fields are cited while adjacent callable auto-accessors must not become obligations.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphExcludesAutoAccessors is a selectable native Go unit entry. runIndexRule writes the two authored TypeScript modules to a temp root, parses them with the TypeScript parser shim and calls graphRule.Check in-process, twice (full fixture and one citation removed); no consumer install, native plugin build or product process is launched.
 */
func TestEvidenceSemanticGraphExcludesAutoAccessors(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": "export class Service {\n  handler = (): void => {};\n  static factory: () => void;\n  accessor callback = (): void => {};\n  static accessor provider: () => void;\n}\n",
    "src/claim.ts": "import type { Service } from \"./contracts.js\";\n\n/**\n * @evidence {@link Service.prototype.handler} Documents the callable instance field.\n * @evidence {@link Service.factory} Documents the callable static field.\n */\nexport interface IClaim {}\n",
  }
  config := "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/claim.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/contracts.ts\"],\"symbol\":\"function\"}}]}"
  messages := runIndexRule(t, files, config)
  if len(messages) != 0 {
    t.Fatalf("the complete original declaration fixture must have no finding: %v", messages)
  }
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], " * @evidence {@link Service.prototype.handler} Documents the callable instance field.\n", "", 1)
  missing := runIndexRule(t, files, config)
  assertProblemContains(t, missing, "Missing acknowledgement for 'Service.prototype.handler'")
}
