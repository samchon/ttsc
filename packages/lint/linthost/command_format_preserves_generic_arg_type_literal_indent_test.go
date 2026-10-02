package linthost

import "testing"

// TestCommandFormatPreservesGenericArgTypeLiteralIndent is a regression guard
// for a type literal in a generic argument that is NOT inside a multi-line
// type operator: the literal opens on the property's own line, so block depth
// equals the visual indent and the depth model is correct. Format must keep
// the member at depth*tabWidth (contrast with the intersection case, where the
// literal opens on an indented `&`-chain line and must be ceded).
//
//  1. Seed an interface property whose generic argument is a type literal opening on the property's own line.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on an interface property `id: tags.Plugin<{ a: true; }>` whose literal opens on the property's own line, and requires the file byte-identical, keeping the member at depth times tab width.
// @evidence contracts/testing.md#independent-expectations The source is an authored literal in Prettier's layout and is its own expected output.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case where block depth equals the visual indent, the counterpart of the intersection and multi-line generic-argument cases that must be ceded. No wrongly indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
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
