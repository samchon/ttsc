package linthost

import "testing"

// TestNoUnsafeFinallyResolvesJumpTargetsInsideAndOutsideTheFinally verifies
// that no-unsafe-finally reports a jump only when its target lies outside the
// finally block.
//
// A `continue` inside a switch targets the enclosing loop, because a switch is
// not a continue target, so it escapes a finally nested in that loop. A labeled
// jump is safe only when the label belongs to a statement inside the finally.
//
//  1. Run the rule over a finally holding a switch whose case continues the loop
//     around the try, and a finally jumping to a label outside it.
//  2. Assert each reports once.
//  3. Run the rule over jumps to a loop, a switch and a label that all lie inside
//     the finally and assert nothing is reported.
//
// @evidence contracts/testing.md#behavioral-verification no-unsafe-finally must report a continue through a switch and a labeled break that leave the finally block, and must stay silent for jumps resolved by a loop, a switch or a label inside it.
// @evidence contracts/testing.md#independent-expectations ECMAScript jump semantics decide the expectations: continue ignores switch statements when resolving its target, and a labeled jump resolves to the statement that carries the label.
// @evidence contracts/testing.md#distinguishing-cases The reported sources and the silent sources differ only in where the target lies, so a rule that ignored every jump near a loop or switch fails the positive cases and one that reported every jump fails the negative ones.
// @evidence contracts/testing.md#execution-ownership TestNoUnsafeFinallyResolvesJumpTargetsInsideAndOutsideTheFinally writes each source to a temporary project, parses it and calls the actual engine in the shared Go unit process; no consumer install or native build runs.
func TestNoUnsafeFinallyResolvesJumpTargetsInsideAndOutsideTheFinally(t *testing.T) {
  for _, source := range []string{
    "function f(k: number): void {\n  for (;;) {\n    try {\n      work();\n    } finally {\n      switch (k) {\n        case 1:\n          continue;\n      }\n    }\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n",
    "function f(): void {\n  outer: for (;;) {\n    try {\n      work();\n    } finally {\n      for (;;) {\n        break outer;\n      }\n    }\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n",
  } {
    _, _, findings := runRuleFindingsSnapshot(t, "no-unsafe-finally", source, nil)
    if len(findings) != 1 {
      t.Fatalf("no-unsafe-finally on %q: want exactly one finding, got %d", source, len(findings))
    }
  }
  for _, source := range []string{
    "function f(): void {\n  try {\n    work();\n  } finally {\n    for (;;) {\n      break;\n    }\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n",
    "function f(k: number): void {\n  try {\n    work();\n  } finally {\n    switch (k) {\n      case 1:\n        break;\n    }\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n",
    "function f(): void {\n  try {\n    work();\n  } finally {\n    inner: for (;;) {\n      for (;;) {\n        break inner;\n      }\n    }\n  }\n}\nfunction work(): void {}\nJSON.stringify(f);\n",
  } {
    assertRuleSkipsSource(t, "no-unsafe-finally", source)
  }
}
