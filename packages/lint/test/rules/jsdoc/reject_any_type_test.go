package linthost

import "testing"

// TestRuleJSDocRejectAnyType verifies jsdoc/reject-any-type rejects any.
//
// This is a content check over JSDoc type braces. It catches weak doc types even
// when jsdoc/no-types is not enabled in a project.
//
// 1. Parse a TypeScript file with @param {any}.
// 2. Enable jsdoc/reject-any-type.
// 3. Assert the @param line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @param {any} is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations The rule rejects unconstrained any while accepting unknown. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The deficient tag in the first source is the reported case, and a second independently authored block using @param {unknown} value description must produce zero findings. Named case variants additionally distinguish exact forbidden type spelling from independently authored user type names and nested generic occurrences.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRejectAnyType is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRejectAnyType(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-any-type", `/**
 * Handles an input.
 * @param {any} value description
 */
export function handle(value: unknown): unknown {
  return value;
}
`, 3)
  assertJSDocRuleLines(t, "jsdoc/reject-any-type", "/**\n * Explains the declaration.\n * @param {unknown} value description\n */\nexport function value(name: unknown): unknown { return name; }\n")
  for _, caseInput := range []struct { name string; docType string; report bool }{
    { "named Any", "Any", false },
    { "named ANY", "ANY", false },
    { "nested any", "Array<any>", true },
    { "wildcard", "*", true },
  } {
    t.Run(caseInput.name, func(t *testing.T) {
      source := "/**\n * Handles the input.\n * @param {" + caseInput.docType + "} value Input value.\n */\nexport function handle(value: unknown): unknown { return value; }\n"
      if caseInput.report {
        assertJSDocRuleLines(t, "jsdoc/reject-any-type", source, 3)
      } else {
        assertJSDocRuleLines(t, "jsdoc/reject-any-type", source)
      }
    })
  }
}
