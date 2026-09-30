package evidence

import (
  "testing"
)

/**
 * Verifies Swagger target grammar: the operation form remains one token and
 * the pre-existing TypeScript symbol grammar is not reinterpreted.
 *
 * Treating `POST /members` as a two-token target would steal slash-prefixed
 * prose from a legitimate TypeScript symbol named `POST`. These adjacent cases
 * pin the backwards-compatible boundary.
 *
 *  1. Parse the safe `POST:/members` operation target.
 *  2. Parse the proposed two-token spelling beside it.
 *  3. Assert only the colon form belongs wholly to the target.
 *
 * @evidence contracts/testing.md#behavioral-verification splitSwaggerTarget separates POST:/members from its reason and retains legacy slash-prefixed reason prose.
 * @evidence contracts/testing.md#independent-expectations Explicit target/reason pairs independently specify token boundaries.
 * @evidence contracts/testing.md#distinguishing-cases Colon target and bare-method legacy token must not swallow reason text.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerTargetUsesOneTokenWithoutReinterpretingReasons is one native Go unit entry in this file. The repository runner selects it in its unit population and calls the rule/parser/cache owner in the shared Go test process; authored inventories or fixture files establish inputs without installing a consumer or starting a product host.
 */
func TestSwaggerTargetUsesOneTokenWithoutReinterpretingReasons(t *testing.T) {
  target, reason := splitDeclarationBody("POST:/members Creates a member.")
  if target != "POST:/members" || reason != "Creates a member." {
    t.Fatalf("colon declaration split into target %q and reason %q", target, reason)
  }
  target, reason = splitDeclarationBody("POST /members is slash-prefixed prose.")
  if target != "POST" || reason != "/members is slash-prefixed prose." {
    t.Fatalf("legacy declaration split into target %q and reason %q", target, reason)
  }
}
