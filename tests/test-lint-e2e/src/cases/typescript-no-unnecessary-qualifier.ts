// Positive: `Foo.Bar` referenced from inside `namespace Foo` — the
// `Foo.` qualifier names the enclosing scope and is redundant.
namespace Foo {
  export const Bar = 1;
  // expect: typescript/no-unnecessary-qualifier error
  export const alias = Foo.Bar;
}

// Positive: enum member referenced from inside the same `enum` body
// via `enum E { X, Y = E.X }`.
enum Color {
  Red = 1,
  // expect: typescript/no-unnecessary-qualifier error
  Crimson = Color.Red,
}

// Positive (type position): `NS.Item` is a `QualifiedName`, the other
// branch of the rule. The qualifier names the enclosing namespace.
namespace NS {
  export interface Item {
    id: number;
  }
  // expect: typescript/no-unnecessary-qualifier error
  export type Alias = NS.Item;
}

// Negative: a local `const bar` shadows `MemberShadow.bar`, so the
// unqualified name would resolve to the local `2`, not the member `1`.
// The `MemberShadow.` qualifier is load-bearing — dropping it changes
// the value read, so the type-aware rule must stay silent (issue #600).
namespace MemberShadow {
  export const bar = 1;
  export function f() {
    const bar = 2;
    return MemberShadow.bar + bar;
  }
}

// Negative: `LocalShadow` here is a local object, not the namespace, so
// its symbol is not a namespace in scope. Dropping the qualifier would
// read the namespace member instead of the local object property.
namespace LocalShadow {
  export const bar = 1;
  export function g() {
    const LocalShadow = { bar: 2 };
    return LocalShadow.bar;
  }
}

// Negative: `Foo.Bar` referenced from outside `namespace Foo` — the
// qualifier is the only way to reach the member.
const outside = Foo.Bar;

// Negative: an unrelated qualified access whose head does not name
// any enclosing scope.
namespace Outer {
  export namespace Inner {
    export const value = 1;
  }
  // The qualifier `Inner` is the path into the inner namespace — the
  // enclosing scope is `Outer`, not `Inner`, so this is fine.
  export const fine = Inner.value;
}

JSON.stringify({ outside, outer: Outer.Inner.value, alias: Foo.alias });
