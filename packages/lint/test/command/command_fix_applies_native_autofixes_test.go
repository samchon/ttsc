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
func TestCommandFixAppliesNativeAutofixes(t *testing.T) {
  root := seedLintProject(t, "var legacy = 1;\nlet stable = legacy;\nif (typeof stable == \"number\") { JSON.stringify(stable); }\n")
  seedLintRules(t, root, map[string]string{
    "eqeqeq":      "error",
    "noVar":       "error",
    "preferConst": "error",
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
  want := "const legacy = 1;\nconst stable = legacy;\nif (typeof stable === \"number\") { JSON.stringify(stable); }\n"
  if string(got) != want {
    t.Fatalf("fixed source mismatch:\nwant %q\ngot  %q", want, string(got))
  }
}
