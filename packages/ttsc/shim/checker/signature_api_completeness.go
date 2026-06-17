package checker

// Compile-time guard: the signature-introspection surface that typia's
// plain.classify from/new construction-strategy detection depends on must
// compose end-to-end through the shim.
//
// 0.15.5 exposed a CONSUMER of a *Signature (Checker_getMinArgumentCount)
// without the PRODUCER that yields one (Checker_getSignaturesOfType): a
// *Signature was nameable (the `Signature` alias) but unobtainable. The closure
// auditor checks that every escaping type can be NAMED, not that it can be
// PRODUCED, so it did not catch the gap and the feature stayed blocked.
//
// This lives in a NORMAL (non-_test) file on purpose. The shim/checker package
// is a nested Go module that no CI job runs `go test` against, so a _test.go
// guard would never be compiled and would silently stop guarding. As ordinary
// package code it is type-checked by every build that links the shim (typia's
// native plugin, ttsc's lint engine), so dropping or renaming any leg below
// turns those builds red. It never runs (assigned to blank, never called).
var _ = func(c *Checker, instanceType *Type) {
  // class instance type -> class symbol -> constructor (static) type, which
  // carries both the construct signatures and the static `from` member.
  classSymbol := Type_getTypeNameSymbol(instanceType)
  ctorType := Checker_getTypeOfSymbol(c, classSymbol)

  // `new C(seed)` strategy: construct signatures -> arity (min args +
  // parameter count, together disambiguating `()` from `(x?)`) -> return type
  // -> the seed parameter's type. A rest-only first parameter `(...xs: S[])`
  // takes its seed from the rest ELEMENT (getRestTypeOfSignature), not the
  // array getTypeOfSymbol yields; Signature_hasRestParameter selects which.
  for _, sig := range Checker_getSignaturesOfType(c, ctorType, SignatureKindConstruct) {
    _ = Checker_getMinArgumentCount(c, sig)
    _ = Signature_parameterCount(sig)
    _ = Checker_getReturnTypeOfSignature(c, sig)
    if Signature_hasRestParameter(sig) {
      _ = Checker_getRestTypeOfSignature(c, sig)
    }
    for _, p := range Signature_parameters(sig) {
      _ = Checker_getTypeOfSymbol(c, p)
    }
  }

  // `C.from(seed)` strategy: static `from` member -> its call signatures, read
  // identically (arity, return type, seed parameter / rest element type).
  fromType := Checker_getTypeOfPropertyOfType(c, ctorType, "from")
  for _, sig := range Checker_getSignaturesOfType(c, fromType, SignatureKindCall) {
    _ = Checker_getMinArgumentCount(c, sig)
    _ = Signature_parameterCount(sig)
    _ = Checker_getReturnTypeOfSignature(c, sig)
    if Signature_hasRestParameter(sig) {
      _ = Checker_getRestTypeOfSignature(c, sig)
    }
    for _, p := range Signature_parameters(sig) {
      _ = Checker_getTypeOfSymbol(c, p)
    }
  }
}
