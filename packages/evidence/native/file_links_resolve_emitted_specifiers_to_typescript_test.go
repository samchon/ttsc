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
 * @evidence contracts/testing.md#behavioral-verification Seven t.Run rows (`.js` with `.ts`, `.tsx` or `.d.ts`; `.mjs` with `.mts` or `.d.mts`; `.cjs` with `.cts` or `.d.cts`) build api/index.ts re-exporting `Target` from `./value<runtime ext>`, an emitted runtime file that exports nothing, and a format-matching source declaring `interface Target { property }` (with a wrong-format `value.ts` decoy for the `.mjs` and `.cjs` rows); the link `#Target.property` must give no diagnostics.
 * @evidence contracts/testing.md#independent-expectations The expectation is authored from the module-resolution contract: an emitted specifier resolves to the TypeScript source of the matching module format, never to the emitted JavaScript (which exports nothing here) or to a wrong-format `.ts` decoy.
 * @evidence contracts/testing.md#distinguishing-cases Each runtime extension with each of its source extensions is a named row, and the decoys sit beside the `.mts` and `.cts` sources so that substitution order matters; the sources are absent from the Program and found on disk.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksResolveEmittedSpecifiersToTypeScript is a Go unit entry in the native test process that owns seven t.Run rows; each drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
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
