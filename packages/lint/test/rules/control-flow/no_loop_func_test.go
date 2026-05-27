package linthost

import "testing"

// TestRuleCorpusNoLoopFunc verifies the lint rule corpus fixture no-loop-func.ts.
//
// The rule visits every loop kind (for, for-in, for-of, while, do-while)
// and walks the loop body, reporting any nested function-like
// declaration. Inner loops and inner function-likes are walk boundaries
// so each enclosing loop only reports the function-likes directly inside
// its own body.
//
// 1. Load the annotated TypeScript fixture source embedded below.
// 2. Enable the rule severity declared by its `// expect:` comments.
// 3. Assert the native Engine reports exactly the annotated diagnostics.
func TestRuleCorpusNoLoopFunc(t *testing.T) {
	assertRuleCorpusCase(t, "no-loop-func.ts", "function inForLoop(): void {\n  for (let i = 0; i < 3; i++) {\n    // expect: no-loop-func error\n    function inner() {\n      return i;\n    }\n    inner();\n  }\n}\nfunction inWhileLoop(): void {\n  let i = 0;\n  while (i < 3) {\n    // expect: no-loop-func error\n    const inner = () => i;\n    inner();\n    i++;\n  }\n}\nfunction inForOfLoop(items: number[]): void {\n  for (const item of items) {\n    // expect: no-loop-func error\n    const make = function () {\n      return item;\n    };\n    make();\n  }\n}\nfunction inForInLoop(obj: Record<string, number>): void {\n  for (const key in obj) {\n    // expect: no-loop-func error\n    const grab = () => obj[key];\n    grab();\n  }\n}\nfunction inDoWhileLoop(): void {\n  let i = 0;\n  do {\n    // expect: no-loop-func error\n    const inner = () => i;\n    inner();\n    i++;\n  } while (i < 3);\n}\nJSON.stringify({ inForLoop, inWhileLoop, inForOfLoop, inForInLoop, inDoWhileLoop });\n")
}
