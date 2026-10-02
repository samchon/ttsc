package linthost

import "testing"

// TestCommandFormatClassHeritageBreak checks the Prettier-3 shape for a class
// header that overflows on its heritage clauses: each `extends`/`implements`
// clause moves to its own line, types stay inline when that clause fits or
// break one per line when it overflows, and the opening brace drops to its own
// line for a non-empty class body. Both the idempotency of
// the broken form and the flat -> broken reflow are covered, for the
// extends+implements (two-clause) and implements-only (multi-type) cases.
//
//  1. Format already-broken class headers (two clauses, implements only, a long
//     implements list, single-type clauses) and require them unchanged.
//  2. Format the flat overflowing forms of the two-clause, implements-only and
//     long-implements headers and require the exact broken layout.
//
// @evidence contracts/testing.md#behavioral-verification Seven subcases run the in-process `format` command on class headers with `extends` and `implements` clauses: broken forms must stay unchanged and flat overflowing forms must be rewritten to one clause per line with `{` on its own line, and a long implements list explodes one type per line.
// @evidence contracts/testing.md#independent-expectations Sources and expected outputs are authored literals in the Prettier 3 class-heritage layout; the three transformation expectations (extends_implements_flat_breaks, implements_only_flat_breaks, extends_implements_many_types_flat_explodes) are complete literal files, not derived from the implementation.
// @evidence contracts/testing.md#distinguishing-cases Covers four fixed points (two-clause, implements-only, many-types explode, single types stay inline) and three flat inputs that must change, so a formatter that does nothing fails the transformation subcases while a formatter that over-breaks fails the single-types-inline case.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged or assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatClassHeritageBreak(t *testing.T) {
  t.Run("extends_implements_broken_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `export class Foo
  extends BaseClassNameThatIsQuiteLong
  implements IA, IB, IC, ID
{
  y = 2;
}
`)
  })
  t.Run("implements_only_broken_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `export class Bar
  implements InterfaceOneLong, InterfaceTwoLong, InterfaceThreeLng
{
  z = 3;
}
`)
  })
  t.Run("extends_implements_flat_breaks", func(t *testing.T) {
    assertFormatResult(t,
      `export class Foo extends BaseClassNameThatIsQuiteLong implements IA, IB, IC, ID {
  y = 2;
}
`,
      `export class Foo
  extends BaseClassNameThatIsQuiteLong
  implements IA, IB, IC, ID
{
  y = 2;
}
`)
  })
  t.Run("implements_only_flat_breaks", func(t *testing.T) {
    assertFormatResult(t,
      `export class Bar implements InterfaceOneLong, InterfaceTwoLong, InterfaceThreeLng {
  z = 3;
}
`,
      `export class Bar
  implements InterfaceOneLong, InterfaceTwoLong, InterfaceThreeLng
{
  z = 3;
}
`)
  })
  // extends + implements where the implements list overflows even on its own
  // line: each interface explodes one-per-line; extends (one type) stays
  // inline. The vscode DiskFileSystemProvider shape.
  t.Run("extends_implements_many_types_explode_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `export class Foo
  extends BaseClass
  implements
    VeryLongInterfaceNameAaaaaaaaaaaaaaaaa,
    VeryLongInterfaceNameBbbbbbbbbbbbbbbbb
{
  y = 2;
}
`)
  })
  // Both clauses carry one type that fits on its own continuation line, so
  // each clause stays inline even though the complete flat header overflowed.
  t.Run("extends_implements_single_types_stay_inline_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `export class Foo
  extends VeryLongBaseClassNameThatIsQuite
  implements OneVeryLongInterfaceNameOk
{
  y = 2;
}
`)
  })
  t.Run("extends_implements_many_types_flat_explodes", func(t *testing.T) {
    assertFormatResult(t,
      `export class Foo extends BaseClass implements VeryLongInterfaceNameAaaaaaaaaaaaaaaaa, VeryLongInterfaceNameBbbbbbbbbbbbbbbbb {
  y = 2;
}
`,
      `export class Foo
  extends BaseClass
  implements
    VeryLongInterfaceNameAaaaaaaaaaaaaaaaa,
    VeryLongInterfaceNameBbbbbbbbbbbbbbbbb
{
  y = 2;
}
`)
  })
}
