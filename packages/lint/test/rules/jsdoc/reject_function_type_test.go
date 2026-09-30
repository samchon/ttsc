package linthost

import "testing"

// TestRuleJSDocRejectFunctionType verifies jsdoc/reject-function-type rejects Function.
//
// The unsafe Function type is equally weak in JSDoc and TypeScript syntax.
// The rule therefore scans the JSDoc type payload directly and reports it.
//
// 1. Parse a TypeScript file with @param {Function}.
// 2. Enable jsdoc/reject-function-type.
// 3. Assert the @param line is reported.
//
// @evidence contracts/testing.md#behavioral-verification assertJSDocRuleLines calls the actual engine and verifies @param {Function} is reported on line 3; exact rule, error severity and line checks detect missing, extra or misplaced findings.
// @evidence contracts/testing.md#independent-expectations The unrestricted Function doc type lacks a call signature; an explicit callable type is the accepted alternative. The literal comment and expected line establish this supported policy independently of the parser or rule result.
// @evidence contracts/testing.md#distinguishing-cases The original malformed or incomplete tag remains intact; an independently authored documented block using @param {function(): void} handler description must produce zero findings. Named case variants additionally distinguish exact forbidden type spelling from independently authored user type names and nested generic occurrences.
// @evidence contracts/testing.md#execution-ownership TestRuleJSDocRejectFunctionType is a named Go unit entry running real comment parsing and the owning engine over virtual TypeScript in the shared test process, without an installed documentation consumer or host.
func TestRuleJSDocRejectFunctionType(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-function-type", `/**
 * Registers a callback.
 * @param {Function} handler description
 */
export function register(handler: () => void): void {
  handler();
}
`, 3)
  t.Run("explicit Closure signature", func(t *testing.T) {
  assertJSDocRuleLines(t, "jsdoc/reject-function-type", "/**\n * Explains the declaration.\n * @param {function(): void} handler description\n */\nexport function value(name: unknown): unknown { return name; }\n")
  })
  for _, caseInput := range []struct { name string; docType string; report bool }{
    { "named FUNCTION", "FUNCTION", false },
    { "nested Function", "Array<Function>", true },
    { "explicit arrow signature", "() => void", false },
  } {
    t.Run(caseInput.name, func(t *testing.T) {
      source := "/**\n * Handles the input.\n * @param {" + caseInput.docType + "} value Input value.\n */\nexport function handle(value: unknown): unknown { return value; }\n"
      if caseInput.report {
        assertJSDocRuleLines(t, "jsdoc/reject-function-type", source, 3)
      } else {
        assertJSDocRuleLines(t, "jsdoc/reject-function-type", source)
      }
    })
  }
}
