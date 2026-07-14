package linthost

import "testing"

// TestUnicornThrowNewErrorReportsCustomAndMemberCallees verifies the rule fires
// for every callee upstream's `^(?:[A-Z][\da-z]*)*Error$` name pattern accepts,
// through an identifier callee and through a non-computed member callee alike.
//
// The port used to carry an eight-entry allowlist of built-in Error names and
// to read the callee through `identifierText`, which returns "" for anything
// that is not an Identifier. User-defined classes (`ValidationError`) and
// namespaced constructors (`ns.FooError()`) — the rule's most common real-world
// target — were therefore accepted in silence. Each case below pins one part of
// the ported predicate: a capitalized word chain, an all-caps acronym word, a
// digit inside a word, `Error` as an interior word, a nested member chain, a
// computed link inside an otherwise static chain, a parenthesized callee, and a
// callee whose object is itself a call. `data.TaggedError("x")` is a positive on
// purpose: upstream's Effect carve-out keys on the exact `Data` object name, so
// any other receiver stays reportable.
//
//  1. Lint `throw <callee>(...);` with only unicorn/throw-new-error enabled.
//  2. Assert exactly one finding carrying the rule's message.
//  3. Assert the finding covers the whole call expression, not just the callee.
func TestUnicornThrowNewErrorReportsCustomAndMemberCallees(t *testing.T) {
  for _, call := range []string{
    `Error("oops")`,
    `TypeError("oops")`,
    `AggregateError([], "oops")`,
    `ValidationError("bad")`,
    `HTTPError()`,
    `Abc3Error()`,
    `MyErrorError()`,
    `ns.FooError("x")`,
    `ns.Error()`,
    `a.b.FooError()`,
    `lib[mod].Error()`,
    `(Error)()`,
    `(( URIError ))()`,
    `getGlobalThis().Error()`,
    `data.TaggedError("x")`,
  } {
    source := "throw " + call + ";\n"
    _, _, findings := runRuleFindingsSnapshot(t, "unicorn/throw-new-error", source, nil)
    if len(findings) != 1 {
      t.Fatalf("%q: want one finding, got %d (%+v)", source, len(findings), findings)
    }
    finding := findings[0]
    if finding.Message != "Use `new` when throwing an error." {
      t.Fatalf("%q: message = %q", source, finding.Message)
    }
    wantPos := len("throw ")
    wantEnd := wantPos + len(call)
    if finding.Pos != wantPos || finding.End != wantEnd {
      t.Fatalf("%q: range = [%d,%d), want [%d,%d)", source, finding.Pos, finding.End, wantPos, wantEnd)
    }
  }
}
