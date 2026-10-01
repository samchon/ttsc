package evidence

import "testing"

/**
 * Verifies namespace forwarding preserves private and type-only failure causes.
 *
 * A namespace marker carries no declaration to inspect and must not replace
 * the concrete class reached through it, including anonymous default classes.
 *
 * 1. Forward private and type-only members through namespace and named exports.
 * 2. Cite the member through the public path.
 * 3. Assert the visibility/value reason instead of a generic missing member.
 *
 * @evidence contracts/testing.md#behavioral-verification Three rows each build a value module, a middle barrel and an index `export * as public from './middle'` through newFileLinkFixture and link `api/index.ts#public.<target>`: a private member through `export * as ns`, a static member through `export type * as ns`, and a private member of an anonymous default class through `export { default }`; the diagnostics must contain `private or protected`, `Type-only` and `private or protected` respectively.
 * @evidence contracts/testing.md#independent-expectations The expected reasons are authored per row from the visibility and type-only contracts: forwarding through a namespace cannot make a private member public or a type-only export a value, and the diagnosis must name that cause rather than a generic missing member.
 * @evidence contracts/testing.md#distinguishing-cases Namespace forwarding, type-only namespace forwarding and an anonymous default class are three paths that reach the concrete class; each asserts its own reason, and only containment is checked.
 * @evidence contracts/testing.md#execution-ownership TestFileLinksDiagnoseForwardedPrivateMembers is a Go unit entry in the native test process that loops over three rows (not named subtests); each drives graphRule.Check through newFileLinkFixture over real temp files, with no consumer install or product host.
 */
func TestFileLinksDiagnoseForwardedPrivateMembers(t *testing.T) {
  for _, test := range []struct{ source, barrel, target, reason string }{
    {"export class Target { private secret = 1; value = 2; }", "export * as ns from './value';", "ns.Target.prototype.secret", "private or protected"},
    {"export class Target { static value = 2; }", "export type * as ns from './value';", "ns.Target.value", "Type-only"},
    {"export default class { private secret = 1; value = 2; }", "export { default } from './value';", "default.prototype.secret", "private or protected"},
  } {
    fixture := newFileLinkFixture(t, map[string]string{"api/value.ts": test.source, "api/middle.ts": test.barrel, "api/index.ts": "export * as public from './middle';", "review.md": "## Review\n<!-- @link api/index.ts#public." + test.target + " Inspects the member. -->\n"}, `{"claims":[{"type":"markdown","files":["review.md"],"symbol":"h2","reference":{"type":"typescript","root":"api","files":["index.ts"],"symbol":["type","property"]}}]}`)
    assertProblemContains(t, fixture.check(), test.reason)
  }
}
