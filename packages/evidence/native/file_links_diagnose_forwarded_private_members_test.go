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
