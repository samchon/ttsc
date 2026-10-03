package linthost

import "testing"

// TestFormatDeclarationHeaderBreaksSingleTypeClauseInMultiClause verifies the
// supported multi-clause class layout when a singleton implements type exceeds
// its keyword-line width. The generic and nongeneric over-width types break
// after the keyword; a fitting singleton stays inline. These independently
// authored cases do not measure past failures or external corpus frequency.
//
// @evidence contracts/testing.md#behavioral-verification The declaration-header rule must break generic and nongeneric over-width singleton implements types after the keyword while leaving fitting singleton clauses inline; the complete format cascade must retain each canonical result.
// @evidence contracts/testing.md#independent-expectations The three independently authored complete canonical literals specify width-eighty singleton clause layout and preserve base types, implemented type arguments and x=1 bodies. Flat input fixtures make each expected canonical result an actual change.
// @evidence contracts/testing.md#distinguishing-cases This host owns generic_single_type_breaks_after_keyword, non_generic_single_type_breaks_after_keyword and fitting_single_type_stays_inline. Every named case now verifies a rule-level transformation plus its original command-level unchanged result, distinguishing mere idempotency from correct reconstruction.
// @evidence contracts/testing.md#execution-ownership TestFormatDeclarationHeaderBreaksSingleTypeClauseInMultiClause is a selected public Go unit under the lint semantic-unit Evidence claim. Each named case directly exercises the syntax-only declaration rule and additionally retains its in-process run(format) cascade/disk assertion on a temporary project, without a consumer install, native product build or external product-host process.
func TestFormatDeclarationHeaderBreaksSingleTypeClauseInMultiClause(t *testing.T) {
  // Generic single type that overflows: break after `implements`, type at +4.
  t.Run("generic_single_type_breaks_after_keyword", func(t *testing.T) {
    assertFixSnapshotWithOptions(t, "format/declaration-header", "class TestItemRenderer extends Disposable implements ITreeRenderer<TestItemTreeElement, FuzzyScore, ITestElementTemplateData> {\n  x = 1;\n}\n", `{"printWidth":80,"tabWidth":2}`, `class TestItemRenderer
  extends Disposable
  implements
    ITreeRenderer<TestItemTreeElement, FuzzyScore, ITestElementTemplateData>
{
  x = 1;
}
`)
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
    assertFixSnapshotWithOptions(t, "format/declaration-header", "class B extends Disposable implements VeryLongNonGenericInterfaceNameThatDefinitelyOverflowsEightyColumnsHereXX {\n  x = 1;\n}\n", `{"printWidth":80,"tabWidth":2}`, `class B
  extends Disposable
  implements
    VeryLongNonGenericInterfaceNameThatDefinitelyOverflowsEightyColumnsHereXX
{
  x = 1;
}
`)
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
    assertFixSnapshotWithOptions(t, "format/declaration-header", "class E extends SomeModeratelyLongBaseClassName implements ITreeRenderer<ElementType, ScoreType> {\n  x = 1;\n}\n", `{"printWidth":80,"tabWidth":2}`, `class E
  extends SomeModeratelyLongBaseClassName
  implements ITreeRenderer<ElementType, ScoreType>
{
  x = 1;
}
`)
    assertFormatUnchanged(t, `class E
  extends SomeModeratelyLongBaseClassName
  implements ITreeRenderer<ElementType, ScoreType>
{
  x = 1;
}
`)
  })
}
