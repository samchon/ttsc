package linthost

import (
  "testing"
)

// TestUnicornPreventAbbreviationsIgnoresNonLexicalJSXAndTupleNamesForCollisions verifies that the TSX fixer compares btn/err renames with authored full output.
//
// Intrinsic JSX tag and labeled tuple element names are not value bindings, independently avoiding false button/error collisions.
//
// @evidence contracts/testing.md#behavioral-verification The TSX fixer compares btn/err renames with authored full output.
// @evidence contracts/testing.md#independent-expectations Intrinsic JSX tag and labeled tuple element names are not value bindings, independently avoiding false button/error collisions.
// @evidence contracts/testing.md#distinguishing-cases Tuple error label and button tag stay intact while btn/err bindings become button/error.
// @evidence contracts/testing.md#execution-ownership TestUnicornPreventAbbreviationsIgnoresNonLexicalJSXAndTupleNamesForCollisions owns its explicit variants and named subcases where present as a discoverable Go unit entry; Checker-backed rule snapshots and actual disk fix application run in the shared Go process with isolated authored fixture files; no installed consumer, native producer or product child host runs.
func TestUnicornPreventAbbreviationsIgnoresNonLexicalJSXAndTupleNamesForCollisions(t *testing.T) {
  source := "type Pair = [error: string];\nconst btn = document.createElement(\"button\");\nconst err = new Error();\nconst view = <button />;\nconsole.log(btn, err, view);\n"
  assertFixSnapshotFile(
    t,
    unicornPreventAbbreviationsRuleName,
    "main.tsx",
    source,
    "type Pair = [error: string];\nconst button = document.createElement(\"button\");\nconst error = new Error();\nconst view = <button />;\nconsole.log(button, error, view);\n",
  )
}
