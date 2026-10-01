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
 * @evidence contracts/testing.md#behavioral-verification splitDeclarationBody splits 'POST:/members Creates a member.' into target 'POST:/members' and reason 'Creates a member.', and 'POST /members is slash-prefixed prose.' into target 'POST' and reason '/members is slash-prefixed prose.'.
 * @evidence contracts/testing.md#independent-expectations Explicit target/reason pairs independently specify token boundaries.
 * @evidence contracts/testing.md#distinguishing-cases Colon target and bare-method legacy token must not swallow reason text.
 * @evidence contracts/testing.md#execution-ownership TestSwaggerTargetUsesOneTokenWithoutReinterpretingReasons is a selectable native Go unit entry. It calls splitDeclarationBody on two literal strings in-process; no consumer, Node process, native build or product host is started.
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
