package linthost

import "testing"

// TestCommandFormatPreservesGenericArgTypeLiteralIndent is a regression guard
// for a type literal in a generic argument that is NOT inside a multi-line
// type operator: the literal opens on the property's own line, so block depth
// equals the visual indent and the depth model is correct. Format must keep
// the member at depth*tabWidth (contrast with the intersection case, where the
// literal opens on an indented `&`-chain line and must be ceded).
//
//  1. Exercise the authored command format preserves generic arg type literal indent fixtures through the Go format dispatcher.
//  2. Require the exact authored output or rejection result for each fixture.
// @evidence contracts/testing.md#behavioral-verification The in-process format command exercises preserves generic arg type literal indent and compares the complete resulting fixture text with the authored answer, so convergence alone cannot certify a wrong rewrite.
// @evidence contracts/testing.md#independent-expectations The literal source or expected output is the independent answer key described above; the command result is never used to manufacture its expected bytes. Preservation assertions own only their canonical inputs and do not establish correctness for arbitrary malformed layout.
// @evidence contracts/testing.md#distinguishing-cases This case owns the supplied fixtures for a regression guard for a type literal in a generic argument that is NOT inside a multi-line type operator: the literal opens on the property's own line, so block depth equals the visual indent and the depth model is correct. Format must keep the member at depth*tabWidth (contrast with the intersection case, where the literal opens on an indented `&`-chain line and must be ceded). Neighboring hosts retain their separately named complementary inputs.
// @evidence contracts/testing.md#execution-ownership TestCommandFormatPreservesGenericArgTypeLiteralIndent owns the named subcases below through the Go format dispatcher and disposable JSON-configured source fixtures, without a child product host or installed consumer.
func TestCommandFormatPreservesGenericArgTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `declare namespace tags {
  type Plugin<T> = object;
}
interface X {
  id: tags.Plugin<{
    a: true;
  }>;
}
`)
}
