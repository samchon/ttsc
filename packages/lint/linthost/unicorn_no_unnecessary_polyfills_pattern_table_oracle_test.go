package linthost

import (
  "testing"
)

// TestUnicornNoUnnecessaryPolyfillsPatternTableOracle verifies the rule's
// module-level pattern/token table against a JavaScript reference generator that
// transcribes construction using pinned core-js-compat data and change-case 5.4.4.
//
// The table drives which import specifiers are even considered a polyfill of a
// given feature; a wrong regex or a missing camelCase token would make the
// rule miss (or over-match) whole families of packages. The fixture records
// every feature's compiled pattern source and token set in construction order.
//
//  1. Load the recorded per-feature pattern/token records.
//  2. Build the Go pattern table from the embedded compat data.
//  3. Assert feature order, pattern source, and token list match the recorded table.
//
// @evidence contracts/testing.md#behavioral-verification polyfillPatterns exposes the actual feature/pattern/token table and is compared in full and in order with the JavaScript reference fixture.
// @evidence contracts/testing.md#independent-expectations The fixture uses pinned upstream compatibility data and camelCase with a transcribed reference table construction, rather than executing the upstream rule algorithm. Shared transcription errors remain a limitation; this table comparison alone does not prove observable matching behavior.
// @evidence contracts/testing.md#distinguishing-cases Every feature, pattern source and token sequence plus total cardinality is checked; TestUnicornNoUnnecessaryPolyfillsChecksOnlyStaticStringSpecifiers separately owns reported and clean source-shape distinctions beyond table equality.
// @evidence contracts/testing.md#execution-ownership TestUnicornNoUnnecessaryPolyfillsPatternTableOracle owns its literal cases as a discoverable Go unit entry; the owning operation runs in the shared Go test process with isolated fixture state and no consumer installation, native producer or product child host.
func TestUnicornNoUnnecessaryPolyfillsPatternTableOracle(t *testing.T) {
  var fixture struct {
    Polyfills []struct {
      Feature string   `json:"feature"`
      Pattern string   `json:"pattern"`
      Tokens  []string `json:"tokens"`
    } `json:"polyfills"`
  }
  readPolyfillOracle(t, "upstream-patterns.json", &fixture)
  tables := polyfillPatterns()
  if len(tables.polyfills) != len(fixture.Polyfills) {
    t.Fatalf("pattern count mismatch: want %d, got %d", len(fixture.Polyfills), len(tables.polyfills))
  }
  for index, want := range fixture.Polyfills {
    got := tables.polyfills[index]
    if got.feature != want.Feature {
      t.Fatalf("polyfill[%d] feature: want %q, got %q", index, want.Feature, got.feature)
    }
    if got.patternSource != want.Pattern {
      t.Fatalf("polyfill[%d] %q pattern:\nwant %s\ngot  %s", index, want.Feature, want.Pattern, got.patternSource)
    }
    assertPolyfillStringSlice(t, "polyfill "+want.Feature+" tokens", got.tokens, want.Tokens)
  }
}
