package linthost

import "testing"

// TestUnicornNumberLiteralCaseFixIsIdempotent verifies the fixed source is a
// fixed point: re-linting it reports nothing.
//
// `ttsc fix` runs the cascade until no edit is produced, so a fixer that
// emitted a still-non-canonical literal would re-report its own output and burn
// every pass before the harness gives up. Feeding each rewritten source back
// through the rule proves the emitted spelling is the one the rule accepts —
// for the exponent, prefix, hex-digit, and BigInt branches alike.
//
//  1. Fix a non-canonical literal of each branch.
//  2. Re-run the rule on the rewritten source.
//  3. Assert the second run finds nothing.
//
// @evidence contracts/testing.md#behavioral-verification Six literal expected rewrites establish the intended output before the unchanged runFixSnapshot probes require at least one edit and zero second-pass findings.
// @evidence contracts/testing.md#independent-expectations The six independently authored full-source pairs require lowercase decimal exponent/radix markers, uppercase hex digits and unchanged lowercase bigint suffix; expected strings are not computed by the normalizer.
// @evidence contracts/testing.md#distinguishing-cases The unchanged six probes cover decimal exponent, negative exponent, combined radix/digit case, e-as-hex-digit, binary prefix and bigint; the preceding exact-output pairs prevent a merely stable wrong normalization from passing this entry.
// @evidence contracts/testing.md#execution-ownership TestUnicornNumberLiteralCaseFixIsIdempotent is a discoverable Go unit host; its literal fixtures and table cases execute the owning engine/fix operations in the shared Go process without consumer installation, native builds or product children. Helper failures retain each input and expected string.
func TestUnicornNumberLiteralCaseFixIsIdempotent(t *testing.T) {
  for _, pair := range []struct{ source, expected string }{
    {"const n = 1E10;\n", "const n = 1e10;\n"},
    {"const n = 2E-5;\n", "const n = 2e-5;\n"},
    {"const n = 0Xff;\n", "const n = 0xFF;\n"},
    {"const n = 0xffe10;\n", "const n = 0xFFE10;\n"},
    {"const n = 0B1010;\n", "const n = 0b1010;\n"},
    {"const n = 0xffn;\n", "const n = 0xFFn;\n"},
  } {
    assertFixSnapshot(t, unicornNumberLiteralCaseRuleName, pair.source, pair.expected)
  }
  for _, source := range []string{
    "const n = 1E10;\n",
    "const n = 2E-5;\n",
    "const n = 0Xff;\n",
    "const n = 0xffe10;\n",
    "const n = 0B1010;\n",
    "const n = 0xffn;\n",
  } {
    fixed, applied := runFixSnapshot(t, unicornNumberLiteralCaseRuleName, source)
    if applied == 0 {
      t.Fatalf("expected a fix for %q", source)
    }
    _, _, findings := runRuleFindingsSnapshot(
      t,
      unicornNumberLiteralCaseRuleName,
      fixed,
      nil,
    )
    if len(findings) != 0 {
      t.Fatalf("fixed source %q still reports %d findings: %+v", fixed, len(findings), findings)
    }
  }
}
