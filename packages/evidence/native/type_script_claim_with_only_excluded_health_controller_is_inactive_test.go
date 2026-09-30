package evidence

import (
  "testing"
)

/**
 * Verifies exclusions can leave a TypeScript claim with zero matched paths.
 *
 * This is the benchmark controller boundary: `HealthController.ts` is a real
 * exported controller but is intentionally outside the evidence claim. Once
 * that exact exclusion removes the only path, its references must not load.
 *
 *  1. Match all controller files and exclude exactly `HealthController.ts`.
 *  2. Supply HealthController as the only controller and an unreadable reference.
 *  3. Assert the resulting healthy zero-path claim is inactive and silent.
 * @evidence contracts/testing.md#behavioral-verification runIndexRule exercises the authored fixture. Assert the resulting healthy zero-path claim is inactive and silent.
 * @evidence contracts/testing.md#independent-expectations This is the benchmark controller boundary: `HealthController.ts` is a real exported controller but is intentionally outside the evidence claim. Once that exact exclusion removes the only path, its references must not load. The authored scenario requires this outcome: Assert the resulting healthy zero-path claim is inactive and silent.
 * @evidence contracts/testing.md#distinguishing-cases Match all controller files and exclude exactly `HealthController.ts`. Supply HealthController as the only controller and an unreadable reference. Assert the resulting healthy zero-path claim is inactive and silent.
 * @evidence contracts/testing.md#execution-ownership TestTypeScriptClaimWithOnlyExcludedHealthControllerIsInactive runs as a Go unit entry in the native package. runIndexRule executes in that process; its fixture files and parsed ASTs are inputs to the owning rules, without installing a consumer or launching a product host.
 */
func TestTypeScriptClaimWithOnlyExcludedHealthControllerIsInactive(t *testing.T) {
  assertNoProblems(t, runIndexRule(t, map[string]string{
    "src/controllers/HealthController.ts": `
export class HealthController {
  public get(): string {
    return "ok";
  }
}
`,
  }, `{"claims":[{
    "type":"typescript",
    "files":[
      "src/controllers/**/*.ts",
      "!src/controllers/HealthController.ts"
    ],
    "symbol":"function",
    "reference":{
      "type":"markdown",
      "root":"missing-docs",
      "files":["**/*.md"],
      "symbol":"h2"
    }
  }]}`))
}
