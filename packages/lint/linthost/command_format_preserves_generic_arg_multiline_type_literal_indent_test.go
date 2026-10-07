package linthost

import "testing"

// TestCommandFormatPreservesGenericArgMultilineTypeLiteralIndent guards a type
// literal that is a generic argument in a multi-line type-argument list
// (`Record<string, { … }>` broken one argument per line). The literal opens on
// an indented continuation line, so its members are indented relative to that
// line, not the block depth; format/indent must cede instead of de-indenting
// them. Contrast the single-line generic-arg guard, where the literal opens on
// the property's own line and the depth model is correct.
//
//  1. Seed a `Record<string, { ... }>` alias with one type argument per line.
//  2. Run `ttsc format` with the default format block.
//  3. Require the file byte-identical.
//
// @evidence contracts/testing.md#behavioral-verification Runs the in-process `format` command on `type T = Record<string, { a: number; b: string; }>` written with one type argument per line and the literal opening on its own continuation line, and requires the file byte-identical.
// @evidence contracts/testing.md#independent-expectations The complete authored literal independently preserves the continuation-line type argument and its two member types, with member indentation relative to the literal's opening line; no independent Prettier invocation establishes these bytes.
// @evidence contracts/testing.md#distinguishing-cases One fixed-point case where block depth differs from the visual indent, so a depth*tabWidth re-indent would change it. The single-line generic-argument case is a separate test; no mis-indented input is repaired here.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: calls run with the format subcommand on a temp-dir project via assertFormatUnchanged; no child process, built binary or installed consumer.
func TestCommandFormatPreservesGenericArgMultilineTypeLiteralIndent(t *testing.T) {
  assertFormatUnchanged(t, `type T = Record<
  string,
  {
    a: number;
    b: string;
  }
>;
`)
}
