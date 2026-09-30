package evidence

import "testing"

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
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies exclusions can leave a TypeScript claim with zero matched paths. The original assertions check assert the resulting healthy zero-path claim is inactive and silent.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations This is the benchmark controller boundary: `HealthController.ts` is a real exported controller but is intentionally outside the evidence claim. Once that exact exclusion removes the only path, its references must not load. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Match all controller files and exclude exactly `HealthController.ts`. Supply HealthController as the only controller and an unreadable reference. Assert the resulting healthy zero-path claim is inactive and silent. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestTypeScriptClaimWithOnlyExcludedHealthControllerIsInactive is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
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
