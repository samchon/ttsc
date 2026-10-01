package evidence

import (
  "strings"
  "testing"
)

/**
 * Verifies graph materializes all callable forms.
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
 * @evidence contracts/testing.md#distinguishing-cases Top-level declarations, arrows, expressions, instance/static methods and callable fields, plus namespace functions and arrows must all resolve.
 * @evidence contracts/testing.md#execution-ownership TestEvidenceSemanticGraphMaterializesAllCallableForms is a selectable native Go unit entry. runIndexRule writes the authored modules to a temp root, parses them with the TypeScript parser shim and calls graphRule.Check in-process, twice (full fixture, then with the 'declared' citation removed); no consumer install, native plugin build or product process is launched.
 */
func TestEvidenceSemanticGraphMaterializesAllCallableForms(t *testing.T) {
  files := map[string]string{
    "src/contracts.ts": "export function declared(): void {}\nexport const arrow = (): void => {};\nexport const expression = function (): void {};\n\nexport class Service {\n  public run(): void {}\n  public execute = (): void => {};\n  public callback!: () => void;\n  public static create(): Service { return new Service(); }\n  public static restore = function (): Service { return new Service(); };\n  public static provider?: () => Service;\n}\n\nexport namespace Orders {\n  export function open(): void {}\n  export const close = (): void => {};\n}\n",
    "src/claim.ts": "import type { Orders, Service, arrow, declared, expression } from \"./contracts.js\";\n\n/**\n * @evidence {@link declared} Covers the exported function declaration.\n * @evidence {@link arrow} Covers the exported arrow function.\n * @evidence {@link expression} Covers the exported function expression.\n * @evidence {@link Service.prototype.run} Covers the public instance method.\n * @evidence {@link Service.prototype.execute} Covers the public function field.\n * @evidence {@link Service.prototype.callback} Covers the direct function-typed field.\n * @evidence {@link Service.create} Covers the public static method.\n * @evidence {@link Service.restore} Covers the public static function field.\n * @evidence {@link Service.provider} Covers the static function-typed field.\n * @evidence {@link Orders.open} Covers the namespace function.\n * @evidence {@link Orders.close} Covers the namespace arrow function.\n */\nexport interface IClaim {}\n",
  }
  config := "{\"claims\":[{\"type\":\"typescript\",\"files\":[\"src/claim.ts\"],\"symbol\":\"type\",\"reference\":{\"type\":\"typescript\",\"files\":[\"src/contracts.ts\"],\"symbol\":\"function\"}}]}"
  messages := runIndexRule(t, files, config)
  if len(messages) != 0 {
    t.Fatalf("the complete original declaration fixture must have no finding: %v", messages)
  }
  files["src/claim.ts"] = strings.Replace(files["src/claim.ts"], " * @evidence {@link declared} Covers the exported function declaration.\n", "", 1)
  missing := runIndexRule(t, files, config)
  assertProblemContains(t, missing, "Missing acknowledgement for 'declared'")
}
