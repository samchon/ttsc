package linthost

import "testing"

// TestRuleCorpusTypescriptClassLiteralPropertyStyle verifies the lint
// rule corpus fixture typescript-class-literal-property-style.ts.
//
// The rule fires on a `get` accessor whose body is a single
// `return <literal>;` and which has no companion setter on the same
// class. Pinpoints the literal-shape predicate and the getter/setter
// pairing check together so a regression in either branch surfaces here.
//
//  1. Load the annotated TypeScript source embedded below.
//  2. Enable the rule severity declared by its `// expect:` comments.
//  3. Assert the native Engine reports one diagnostic per literal-only
//     getter and leaves the setter-paired and computed-body getters alone.
func TestRuleCorpusTypescriptClassLiteralPropertyStyle(t *testing.T) {
  assertRuleCorpusCase(t, "typescript-class-literal-property-style.ts", "class StringGetter {\n  // expect: typescript/class-literal-property-style error\n  static get label(): string {\n    return \"ttsc\";\n  }\n}\nclass NumberGetter {\n  // expect: typescript/class-literal-property-style error\n  static get version(): number {\n    return 1;\n  }\n}\nclass NegativeGetter {\n  // expect: typescript/class-literal-property-style error\n  static get offset(): number {\n    return -42;\n  }\n}\nclass TemplateGetter {\n  // expect: typescript/class-literal-property-style error\n  get banner(): string {\n    return `static template`;\n  }\n}\nclass GetterWithSetter {\n  private _flag = \"yes\";\n  get flag(): string {\n    return this._flag;\n  }\n  set flag(value: string) {\n    this._flag = value;\n  }\n}\nclass ComputedGetter {\n  static get computed(): number {\n    return 1 + 2;\n  }\n}\nclass FieldShape {\n  static readonly label = \"ok\";\n}\nJSON.stringify({ StringGetter, NumberGetter, NegativeGetter, TemplateGetter, GetterWithSetter, ComputedGetter, FieldShape });\n")
}
