package evidence

import "testing"

/**
 * Verifies default addresses respect public, star, namespace, and type-only exports.
 *
 * Default identity is a declaration identity, not permission to expose a local
 * binding or value members through a type-only edge.
 *
 * 1. Publish defaults through declaration, alias, and imported-binding forms.
 * 2. Assert legitimate public addresses and namespace forwarding resolve.
 * 3. Reject default-only local names, ordinary star defaults, and type-only values.
 *
 * @evidence contracts/testing.md#behavioral-verification Ten t.Run rows build api/value.ts, api/index.ts and a review.md `@link` under a root-`api` reference through newFileLinkFixture; the rows that must resolve (a re-exported default class, a namespace-forwarded default, a type-only default class address, and an imported default) must give no diagnostics, and the rows that must fail (a private local, named-default and star-default forms, a type-only default member, a specifier-level type member, and a type-imported default) must give at least one diagnostic.
 * @evidence contracts/testing.md#independent-expectations The per-row allowed flag is an authored table from TypeScript's export rules: a default is a declaration identity that does not expose a local binding through a star export or value members through a type-only edge. Rejected rows assert only that some diagnostic exists, so their precise cause is not pinned.
 * @evidence contracts/testing.md#distinguishing-cases Ten named rows cover declaration, alias, imported-binding, namespace and type-only default forms, each with an allowed twin or counterpart; a resolver that ignored type-only or star boundaries would flip at least one row.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksDefaultsObeyExportBoundaries is a Go unit entry in the native test process that owns ten t.Run rows; each drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
 */
func TestFileLinksDefaultsObeyExportBoundaries(t *testing.T) {
  for _, test := range []struct {
    name, source, barrel, target, symbol string
    allowed                              bool
  }{
    {"local default", "class Target { static property = 1; } export default Target;", "export { default } from './value';", "default.property", "property", true},
    {"private local", "class Target { static property = 1; } export default Target;", "export * from './value';", "Target.property", "property", false},
    {"named default local", "export default class Target { static property = 1; }", "export * from './value';", "Target.property", "property", false},
    {"star default", "export default class { static property = 1; }", "export * from './value';", "default.property", "property", false},
    {"namespace default", "export default class { static property = 1; }", "export * as ns from './value';", "ns.default.property", "property", true},
    {"type default class", "class Target { static property = 1; } export type { Target as default };", "export { default } from './value';", "default", "type", true},
    {"type default member", "class Target { static property = 1; } export type { Target as default };", "export { default } from './value';", "default.property", "property", false},
    {"specifier type member", "class Target { static property = 1; } export { type Target as default };", "export { default } from './value';", "default.property", "property", false},
    {"imported default", "export class Target { static property = 1; }", "import { Target } from './value'; export default Target;", "default.property", "property", true},
    {"type imported default", "export class Target { static property = 1; }", "import type { Target } from './value'; export default Target;", "default.property", "property", false},
  } {
    t.Run(test.name, func(t *testing.T) {
      fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": test.source, "api/index.ts": test.barrel, "review.md": "## Review\n<!-- @link api/index.ts#" + test.target + " Reads the selected declaration. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":"`+test.symbol+`"}}]}`)
      messages := fixture.check()
      if test.allowed {
        assertNoProblems(t, messages)
      } else if len(messages) == 0 {
        t.Fatal("an unavailable export satisfied coverage")
      }
    })
  }
}
