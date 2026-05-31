package linthost

import "testing"

// TestCommandFormatSwitchCaseBlockIndent covers the indentation of brace
// blocks under switch clauses. A same-line block (`case X: { … }`) is indented
// like a braceless `case X: stmt` (no extra level); a block on its own line
// under the clause (`case X:` then `{`) is an ordinary nested block (one level
// deeper, its `}` one level up from its body). Both forms, and the default
// clause, are covered for idempotency, plus a de-indented separate-line block
// is re-indented.
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
