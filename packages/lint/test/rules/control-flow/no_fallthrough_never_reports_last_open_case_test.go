package linthost

import "testing"

// TestNoFallthroughNeverReportsLastOpenCase verifies the final case is exempt even when its end is reachable.
//
// There is no next label to fall into, so a last case without a break is
// fine (upstream valid case `case 0: a();` as the only clause). Locks the
// transition pairing: only clause pairs are examined, never the final
// clause alone.
//
// 1. Build a switch whose only case ends without a break.
// 2. Run the engine with no-fallthrough enabled.
// 3. Assert zero findings.
func TestNoFallthroughNeverReportsLastOpenCase(t *testing.T) {
  assertNoFallthroughClean(t, `declare const foo: number;
switch (foo) {
  case 0:
    console.log(0);
}
`, "")
}
