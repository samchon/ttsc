package linthost

import "testing"

// TestCommandFormatSwitchCaseBlockIndent covers the indentation of brace
// blocks under switch clauses. A same-line block (`case X: { … }`) is indented
// like a braceless `case X: stmt` (no extra level); a block on its own line
// under the clause (`case X:` then `{`) is an ordinary nested block (one level
// deeper, its `}` one level up from its body). Both forms, and the default
// clause, are covered for idempotency, plus a de-indented separate-line block
// is re-indented.
//
//  1. Seed two canonical switches and one switch whose separate-line case block is mis-indented.
//  2. Run `ttsc format` with the default format block on each.
//  3. Require the canonical two unchanged and the third rewritten to the authored indentation.
//
// @evidence contracts/testing.md#behavioral-verification Three subcases run the in-process `format` command: a switch mixing separate-line and same-line case blocks plus a `default` block stays unchanged, a `default` with a separate-line block stays unchanged, and a mis-indented separate-line case block is rewritten to one level deeper than the clause.
// @evidence contracts/testing.md#independent-expectations Sources and the one rewrite expectation are authored literals reasoned from the stated rule (same-line block like a braceless clause body, separate-line block one level deeper with its `}` one level up); nothing is derived from the formatter.
// @evidence contracts/testing.md#distinguishing-cases Two fixed points cover both block placements and the default clause; the third input has a body and closing brace that must move, so the formatter cannot pass by doing nothing.
// @evidence contracts/testing.md#execution-ownership In-process Go unit: each subcase calls run with the format subcommand on a temp-dir project via assertFormatUnchanged or assertFormatResult; no child process, built binary or installed consumer.
func TestCommandFormatSwitchCaseBlockIndent(t *testing.T) {
  t.Run("mixed_case_block_styles_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `function f(x: string): void {
  switch (x) {
    case "A":
      {
        const resolved = 1;
        if (resolved) {
          return;
        }
      }
      break;
    case "B": {
      const y = 2;
      break;
    }
    default: {
      const z = 3;
      break;
    }
  }
}
`)
  })
  t.Run("default_separate_line_block_idempotent", func(t *testing.T) {
    assertFormatUnchanged(t, `function f(x: string): void {
  switch (x) {
    default:
      {
        const z = 3;
      }
      break;
  }
}
`)
  })
  t.Run("separate_line_case_block_reindented", func(t *testing.T) {
    assertFormatResult(t,
      `function f(x: string): void {
  switch (x) {
    case "A":
      {
      const a = 1;
    }
      break;
  }
}
`,
      `function f(x: string): void {
  switch (x) {
    case "A":
      {
        const a = 1;
      }
      break;
  }
}
`)
  })
}
