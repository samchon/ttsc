package linthost

import "testing"

// TestCommandFormatClassHeritageBreak checks the Prettier-3 shape for a class
// header that overflows on its heritage clauses: each `extends`/`implements`
// clause moves to its own line, the clause types stay inline, and the opening
// `{` drops to its own line (a non-empty class body). Both the idempotency of
// the broken form and the flat -> broken reflow are covered, for the
// extends+implements (two-clause) and implements-only (multi-type) cases.
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
  // both clauses carry a single type: each clause stays inline (Prettier never
  // explodes a one-type clause) even though the flat header overflowed.
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
