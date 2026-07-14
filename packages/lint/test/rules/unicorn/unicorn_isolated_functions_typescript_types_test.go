package linthost

import "testing"

// TestUnicornIsolatedFunctionsTypeScriptTypes verifies that type-only
// references to outer bindings never count as scope escapes: an isolated
// function may name outer types and `typeof` outer values in type positions.
//
// Upstream skips identifiers whose parent is a TSTypeReference or TSTypeQuery;
// the port mirrors that so `typeof a`, generic constraints, `as`, `satisfies`,
// and conditional types stay silent while their runtime values are declared
// inside the function.
//
// 1. Reference outer `a` (via `typeof`) and outer `MyType` only in type
//    positions inside a makeSynchronous callback.
// 2. Assert nothing is reported.
func TestUnicornIsolatedFunctionsTypeScriptTypes(t *testing.T) {
  source := `declare function makeSynchronous<T>(fn: T): T;

const a = 1;
type MyType = { foo: string };
makeSynchronous(() => {
  const b: typeof a = 1;
  const f = <T extends MyType>(t: T) => t;
  let myType: MyType = { foo: "bar" };
  myType = { foo: "bar" } as MyType;
  myType = { foo: "bar" } as const;
  myType = { foo: "baz" } satisfies MyType;
  type X = typeof myType extends MyType ? true : false;
  return [b, f, myType] as X extends true ? unknown[] : never;
});
`
  assertUnicornIsolatedFunctionsFindings(t, runUnicornIsolatedFunctions(t, source, ""))
}
