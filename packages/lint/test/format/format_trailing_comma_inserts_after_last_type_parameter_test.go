package main

import "testing"

// TestFormatTrailingCommaInsertsAfterLastTypeParameter verifies the rule
// reaches multi-line TypeScript type-parameter declaration lists.
//
// Prettier's `trailingComma: "all"` adds trailing commas to multi-line
// `<T, U>` at the declaration site (prettier PR #10353 + #10109). The
// rule's `KindTypeParameter` arm dispatches once per parameter but only
// acts when the visited parameter is the LAST in its parent's
// `TypeParameterList`, then anchors the close `>` via
// `findCloseTokenAfter`. Pinning the declaration-site case keeps the new
// dispatch regression-safe and locks the prettier-parity claim against
// the asymmetric type-argument case (`foo<A, B>(…)` call site) which
// prettier intentionally leaves alone.
//
//  1. Parse a source file with one multi-line generic function declaration.
//  2. Apply the rule's finding through the disk-backed fixer.
//  3. Assert the rewritten file contains the trailing comma after the
//     last type parameter.
func TestFormatTrailingCommaInsertsAfterLastTypeParameter(t *testing.T) {
  assertFixSnapshot(
    t,
    "format/trailing-comma",
    "function pick<\n  T extends object,\n  K extends keyof T\n>(obj: T, key: K): T[K] {\n  return obj[key];\n}\npick;\n",
    "function pick<\n  T extends object,\n  K extends keyof T,\n>(obj: T, key: K): T[K] {\n  return obj[key];\n}\npick;\n",
  )
}
