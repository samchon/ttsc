package linthost

import (
  "os"
  "path/filepath"
  "testing"
)

// TestCommandFixAppliesNativeAutofixes verifies fix rewrites native rule findings.
//
// Fix runs before the final diagnostic render and may need multiple native
// passes: noVar first rewrites `var` to `let`, then preferConst can see the
// newly block-scoped declaration and rewrite it to `const`.
//
// 1. Create a project with noVar, preferConst, and eqeqeq violations.
// 2. Run the fix command with those native rules enabled.
// 3. Assert the command succeeds and the source file contains the fixed text.
//
// @evidence contracts/testing.md#behavioral-verification Actual in-process fix command applies no-var, prefer-const and eqeqeq cascades, returns zero with empty streams and writes the complete authored const/strict-equality source.
// @evidence contracts/testing.md#independent-expectations A literal full expected source independently specifies both declarations and equality replacement, rather than deriving expected changes from the fixer or checking only edited substrings.
// @evidence contracts/testing.md#distinguishing-cases Var-to-let exposes a later prefer-const pass while a separate existing let and typeof equality exercise additional fixes; full byte equality prevents collateral text loss and half-completed cascades.
// @evidence contracts/testing.md#execution-ownership Real command, supported in-process compiler, Engine and disk writes execute on a temporary fixture in one Go process; native here describes built-in rules, not a separately compiled plugin or installed CLI.
func TestCommandFixAppliesNativeAutofixes(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1;\nlet stable = legacy;\nif (typeof stable == \"number\") { JSON.stringify(stable); }\nexport {};\n")
  seedLintRules(t, root, map[string]string{
    "eqeqeq":       "error",
    "no-var":       "error",
    "prefer-const": "error",
  })
  code, stdout, stderr := captureCommandOutput(t, func() int {
    return run([]string{
      "fix",
      "--cwd", root,
      "--plugins-json", lintManifest(t),
    })
  })
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("fix command mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  got, err := os.ReadFile(filepath.Join(root, "src", "main.ts"))
  if err != nil {
    t.Fatalf("ReadFile: %v", err)
  }
  want := "const legacy = 1;\nconst stable = legacy;\nif (typeof stable === \"number\") { JSON.stringify(stable); }\nexport {};\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
