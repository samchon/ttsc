package evidence

import "testing"

/**
 * Verifies disk re-exports substitute TypeScript sources for emitted specifiers.
 *
 * The sources are absent from the Program and emitted JavaScript exists beside
 * them. An unrelated extension must not override the requested module format.
 *
 * 1. Publish .js, .mjs, and .cjs re-exports with source/declaration siblings.
 * 2. Assert the barrel's property resolves while the JS output exports nothing.
 * 3. Keep a wrong-format .ts decoy beside .mts/.cts to pin substitution order.
 *
 * @evidence contracts/testing.md#behavioral-verification graphRule.Check through the file-link fixture exercises this case. Verifies disk re-exports substitute TypeScript sources for emitted specifiers.
 *
 * @evidence contracts/testing.md#independent-expectations The emitted files deliberately export nothing while their format-matching TypeScript sources export Target.property; clean resolution rejects JS or wrong-format decoy selection.
 *
 * @evidence contracts/testing.md#distinguishing-cases Publish .js, .mjs, and .cjs re-exports with source/declaration siblings. Assert the barrel's property resolves while the JS output exports nothing. Keep a wrong-format .ts decoy beside .mts/.cts to pin substitution order.
 *
 * @evidence contracts/testing.md#execution-ownership TestFileLinksResolveEmittedSpecifiersToTypeScript is the selectable Go entry and owns its fixture variants and local closures. It invokes graphRule.Check through the file-link fixture in the native Go process. Its fixture files and parsed TypeScript inputs feed the graph directly; only Markdown/TypeScript populations are configured, so Prisma and Swagger loader gates return before spawning processes.
 */
func TestFileLinksResolveEmittedSpecifiersToTypeScript(t *testing.T) {
  for _, test := range []struct{ runtime, source string }{{".js", ".ts"}, {".js", ".tsx"}, {".js", ".d.ts"}, {".mjs", ".mts"}, {".mjs", ".d.mts"}, {".cjs", ".cts"}, {".cjs", ".d.cts"}} {
    t.Run(test.source, func(t *testing.T) {
      files := map[string]string{"review.md": "## Review\n<!-- @link api/index.ts#Target.property Reads the field. -->\n", "api/index.ts": "export { Target } from './value" + test.runtime + "';", "api/value" + test.runtime: "export {};", "api/value" + test.source: "export interface Target { property: number; }"}
      if test.runtime != ".js" {
        files["api/value.ts"] = "export interface Wrong {}"
      }
      fixture := newFileLinkFixture(t, files, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"property"}}]}`)
      assertNoProblems(t, fixture.check())
    })
  }
}
