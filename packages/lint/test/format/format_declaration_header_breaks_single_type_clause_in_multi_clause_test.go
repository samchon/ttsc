package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksSingleTypeClauseInMultiClause pins Prettier's
// handling of a multi-clause class header (`extends` + `implements`) where the
// `implements` clause carries a single type that overflows on the keyword line:
// Prettier breaks after the keyword and drops the lone type to the next indent
// level, generic or not. Earlier the rule kept any single-type clause inline,
// leaving an over-wide `  implements ITreeRenderer<…>` line (the dominant vscode
// renderer-header divergence).
func TestFormatDeclarationHeaderBreaksSingleTypeClauseInMultiClause(t *testing.T) {
  // Generic single type that overflows: break after `implements`, type at +4.
  t.Run("generic_single_type_breaks_after_keyword", func(t *testing.T) {
    assertFormatUnchanged(t, `class TestItemRenderer
  extends Disposable
  implements
    ITreeRenderer<TestItemTreeElement, FuzzyScore, ITestElementTemplateData>
{
  x = 1;
}
`)
  })
  // Non-generic single type that overflows breaks the same way.
  t.Run("non_generic_single_type_breaks_after_keyword", func(t *testing.T) {
    assertFormatUnchanged(t, `class B
  extends Disposable
  implements
    VeryLongNonGenericInterfaceNameThatDefinitelyOverflowsEightyColumnsHereXX
{
  x = 1;
}
`)
  })
  // A multi-clause header whose flat form overflows but whose single-type
  // clauses each fit on their own keyword line stays inline per clause (no
  // spurious break after the keyword).
  t.Run("fitting_single_type_stays_inline", func(t *testing.T) {
    assertFormatUnchanged(t, `class E
  extends SomeModeratelyLongBaseClassName
  implements ITreeRenderer<ElementType, ScoreType>
{
  x = 1;
}
`)
  })
}
