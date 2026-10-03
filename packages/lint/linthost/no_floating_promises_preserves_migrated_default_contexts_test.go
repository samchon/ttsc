package linthost

import "testing"

// TestNoFloatingPromisesPreservesMigratedDefaultContexts verifies the preserved rule-family diagnostic set.
//
// Separates the original consumer case's portable semantics from package
// discovery while retaining its exact source and compiler settings.
//
// 1. Materialize the original source and compiler configuration.
// 2. Run the owning command operation with the scalar rule setting.
// 3. Compare the matched main.ts rule errors and the command failure status.
//
// @evidence contracts/testing.md#behavioral-verification The command rejects the four floating built-in Promise forms without broadening default checking to the structural custom thenable.
// @evidence contracts/testing.md#independent-expectations Literal lines 1 through 4 preserve the authored missing catch handler, finally-only chain, absent then handlers and Promise-array counterexamples from issue 412.
// @evidence contracts/testing.md#distinguishing-cases Empty catch, finally and undefined then handlers fail to handle rejection; the Promise array reports while the declared custom thenable stays clean under default checkThenables false.
// @evidence contracts/testing.md#execution-ownership TestNoFloatingPromisesPreservesMigratedDefaultContexts executes through assertMigratedTypedRuleCase and the owning Go command in the shared lint unit process. Fixture files require no native build or consumer installation; package auto-discovery and native transport remain separate E2E responsibilities, whose survival is not certified here.
func TestNoFloatingPromisesPreservesMigratedDefaultContexts(t *testing.T) {
  assertMigratedTypedRuleCase(t, "Promise.reject(new Error(\"catch\")).catch();\nPromise.reject(new Error(\"finally\")).finally(() => undefined);\nPromise.resolve().then(undefined, undefined);\n[Promise.resolve(1), Promise.resolve(2)];\n\ninterface CustomThenable {\n  then(onFulfilled: () => void, onRejected: () => void): CustomThenable;\n}\ndeclare const customThenable: CustomThenable;\ncustomThenable;\n\nexport {};\n", "{\"compilerOptions\":{\"noEmit\":true,\"strict\":true,\"target\":\"ES2022\",\"module\":\"NodeNext\",\"moduleResolution\":\"NodeNext\"},\"files\":[\"src/main.ts\"]}", "{\"name\":\"no-floating-promises-no-plugins-entry-fixture\",\"private\":true,\"dependencies\":{\"@ttsc/lint\":\"*\"}}", "typescript/no-floating-promises", "error", []ruleExpectation{{Rule: "typescript/no-floating-promises", Severity: SeverityError, Line: 1}, {Rule: "typescript/no-floating-promises", Severity: SeverityError, Line: 2}, {Rule: "typescript/no-floating-promises", Severity: SeverityError, Line: 3}, {Rule: "typescript/no-floating-promises", Severity: SeverityError, Line: 4}})
}
