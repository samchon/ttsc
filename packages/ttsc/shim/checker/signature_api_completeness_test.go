package checker

// Signature introspection must compose end-to-end through the shim.
//
// 0.15.5 exposed two CONSUMERS of a *Signature — Checker_getMinArgumentCount and
// (originally absent) Checker_getReturnTypeOfSignature — without the PRODUCER
// that yields one (Checker_getSignaturesOfType). A *Signature was nameable (the
// `Signature` alias) but unobtainable, so a plugin could not actually count a
// signature's arguments or read its return type. The closure auditor checks that
// every escaping type can be NAMED, not that it can be PRODUCED, so it did not
// catch this; downstream (typia's plain.classify from/new construction-strategy
// detection) was blocked until 0.15.6.
//
// This compile-time reference is the focused guard: if any leg of the triad
// (get the signatures -> count min args / read return type) is dropped in a
// future typescript-go bump or shim regeneration, this file fails to compile and
// the build/test goes red. It never runs (the closure is assigned to blank), so
// it needs no live Checker.
var _ = func(c *Checker, t *Type) {
  for _, sig := range Checker_getSignaturesOfType(c, t, SignatureKindConstruct) {
    _ = Checker_getMinArgumentCount(c, sig)
    _ = Checker_getReturnTypeOfSignature(c, sig)
    // parameterCount disambiguates `()` from `(x?)`, which getMinArgumentCount
    // (0 for both) cannot — the plugin needs it to honor an optional-first
    // constructor/factory instead of silently falling back to field copy.
    _ = Signature_parameterCount(sig)
  }
}
