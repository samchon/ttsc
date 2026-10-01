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
 * @evidence contracts/testing.md#behavioral-verification runIndexRule runs the graph rule with a function claim over src/views/** and a package reference `@org/api` narrowed to `lib/questions/**`, where the package entry re-exports `questions` and `reviews` namespaces; the diagnostics must contain `Missing acknowledgement for 'questions.get'` and none for `'reviews.erase'`.
 * @evidence contracts/testing.md#independent-expectations The expectations are authored from the glob contract: package globs are relative to the package root, so the selected area is demanded under the address the entry gives it, and the other reachable area is not owed.
 * @evidence contracts/testing.md#distinguishing-cases Two areas both reachable from the entry with a package-relative glob selecting one; a glob resolved against the project root would match nothing, leaving no owed units.
 * @evidence contracts/testing.md#execution-ownership TestGraphResolvesPackageGlobsAgainstThePackageRoot is a Go unit entry in the native test process; runIndexRule writes the fixtures (including a node_modules package) to a temp directory and calls the graph rule directly, with no consumer install or product host.
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
