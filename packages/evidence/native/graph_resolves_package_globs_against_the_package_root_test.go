package evidence

import "testing"

/**
 * Verifies globs inside a package resolve against the package root.
 *
 * Narrowing a large SDK to one area is the difference between an obligation a
 * team can adopt and one they switch off. Resolving those globs against the
 * project root instead would match nothing and read as a satisfied population.
 *
 *  1. Publish a package with two areas, both reachable from its entry.
 *  2. Narrow the reference to one of them with a package-relative glob.
 *  3. Assert only that area is demanded, under the address the entry gives it.
 * @evidence .agents/skills/contracts/testing.md#behavioral-verification runIndexRule exercises this case: Verifies globs inside a package resolve against the package root. The original assertions check assert only that area is demanded, under the address the entry gives it.
 * @evidence .agents/skills/contracts/testing.md#independent-expectations Narrowing a large SDK to one area is the difference between an obligation a team can adopt and one they switch off. Resolving those globs against the project root instead would match nothing and read as a satisfied population. The authored fixture and literal assertions below pin that contract; this test does not treat the reported result as its expected result.
 * @evidence .agents/skills/contracts/testing.md#distinguishing-cases Publish a package with two areas, both reachable from its entry. Narrow the reference to one of them with a package-relative glob. Assert only that area is demanded, under the address the entry gives it. The assertions and inputs in this function retain its own failure identity.
 * @evidence .agents/skills/contracts/testing.md#execution-ownership TestGraphResolvesPackageGlobsAgainstThePackageRoot is the selectable Go test entry; its local loops and closures remain owned by this entry. It calls runIndexRule within the native Go test process. Authored fixture files are rule inputs, not a consumer build or product host.
 */
func TestGraphResolvesPackageGlobsAgainstThePackageRoot(t *testing.T) {
  messages := runIndexRule(t, map[string]string{
    "node_modules/@org/api/package.json": packageManifest,
    "node_modules/@org/api/lib/index.d.ts": `
export * as questions from "./questions/get.js";
export * as reviews from "./reviews/erase.js";
`,
    "node_modules/@org/api/lib/questions/get.d.ts": "export declare function get(): void;\n",
    "node_modules/@org/api/lib/reviews/erase.d.ts": "export declare function erase(): void;\n",
    "src/views/detail.ts":                          "export function detail(): void {}\n",
  }, `{"claims":[{
    "type":"typescript",
    "files":["src/views/**"],
    "symbol":"function",
    "reference":{"type":"typescript","package":"@org/api","files":["lib/questions/**"],"symbol":"function"}
  }]}`)
  assertProblemContains(t, messages, "Missing acknowledgement for 'questions.get'")
  if countProblemsContaining(messages, "Missing acknowledgement for 'reviews.erase'") != 0 {
    t.Fatalf("a package glob leaked outside the area it selected:\n%v", messages)
  }
}
