package linthost

import "testing"

// TestRuleTypescriptNoUnnecessaryQualifier verifies the type-aware
// `typescript/no-unnecessary-qualifier` rule fires only when the qualifier
// is genuinely redundant.
//
// The rule was previously AST-only and fired on text identity alone, so it
// flagged load-bearing qualifiers (issue #600): a member shadowed by a
// local binding, or a namespace name shadowed by a local object. Following
// that advice silently changed which binding the code read. The port now
// mirrors upstream `qualifierIsUnnecessary` — the head must resolve to an
// enclosing namespace/enum symbol AND the unqualified member name must
// resolve, from the same location, to the same symbol the qualified access
// reaches. These cases pin both the positive fire and each shadowing arm
// that must stay silent, with expectations taken from the upstream rule.
//
//  1. Report `Foo.Bar` inside `namespace Foo` and `Color.Red` inside
//     `enum Color`, each at its exact byte range.
//  2. Skip both shadowing arms (local `bar` hiding `Foo.bar`; local `Foo`
//     object hiding the namespace) where dropping the qualifier would
//     change behavior.
//  3. Skip an access from outside the namespace and a path into an inner
//     namespace, where the qualifier is not the enclosing scope.
func TestRuleTypescriptNoUnnecessaryQualifier(t *testing.T) {
  const ruleName = "typescript/no-unnecessary-qualifier"
  cases := []struct {
    name    string
    source  string
    markers []string
  }{
    {
      name: "namespace member qualifier is redundant",
      source: "namespace Foo {\n" +
        "  export const Bar = 1;\n" +
        "  export const alias = Foo.Bar;\n" +
        "}\n",
      markers: []string{"Foo.Bar"},
    },
    {
      name: "enum member qualifier is redundant",
      source: "enum Color {\n" +
        "  Red = 1,\n" +
        "  Crimson = Color.Red,\n" +
        "}\n",
      markers: []string{"Color.Red"},
    },
    {
      // Type position: `NS.Item` is a QualifiedName, the other branch of
      // the rule. The qualifier names the enclosing namespace, so the
      // type reference resolves to the same interface unqualified.
      name: "namespace type qualifier is redundant",
      source: "namespace NS {\n" +
        "  export interface Item {\n" +
        "    id: number;\n" +
        "  }\n" +
        "  export type Alias = NS.Item;\n" +
        "}\n",
      markers: []string{"NS.Item"},
    },
    {
      // Upstream: valid. `const bar` shadows `Foo.bar`, so the unqualified
      // `bar` resolves to the local `2`, not the member `1`. Dropping
      // `Foo.` would change the value read.
      name: "shadowed member keeps its qualifier",
      source: "namespace Foo {\n" +
        "  export const bar = 1;\n" +
        "  export function f() {\n" +
        "    const bar = 2;\n" +
        "    return Foo.bar + bar;\n" +
        "  }\n" +
        "}\n",
    },
    {
      // Upstream: valid. `Foo` here is a local object, not the namespace,
      // so its symbol is not a namespace in scope. Dropping `Foo.` would
      // read the namespace member instead of the local object property.
      name: "local object shadowing the namespace keeps its qualifier",
      source: "namespace Foo {\n" +
        "  export const bar = 1;\n" +
        "  export function g() {\n" +
        "    const Foo = { bar: 2 };\n" +
        "    return Foo.bar;\n" +
        "  }\n" +
        "}\n",
    },
    {
      // The access lives outside `namespace Foo`, so the qualifier is the
      // only way to reach the member.
      name: "reference from outside the namespace keeps its qualifier",
      source: "namespace Foo {\n" +
        "  export const Bar = 1;\n" +
        "}\n" +
        "export const outside = Foo.Bar;\n",
    },
    {
      // The enclosing scope is `Outer`, not `Inner`; `Inner.value` is the
      // path into the inner namespace, so the qualifier is necessary.
      name: "path into an inner namespace keeps its qualifier",
      source: "namespace Outer {\n" +
        "  export namespace Inner {\n" +
        "    export const value = 1;\n" +
        "  }\n" +
        "  export const fine = Inner.value;\n" +
        "}\n",
    },
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
      assertRuleFindingRanges(t, ruleName, test.source, test.markers...)
    })
  }
}
