package ttsc_test

import (
  "strings"
  "testing"
)

// TestCLICommandRunsProjectFromCurrentDirectory verifies bare `ttsc` builds the
// process working directory project.
//
// The no-argument command path must choose project build, not help text. This
// black-box test runs a built command from the fixture directory so the observed
// behavior depends on the child process cwd.
//
// 1. Create a no-emit project in a temporary directory.
// 2. Execute the built native command with no arguments from that directory.
// 3. Assert the project build succeeds without printing usage text.
func TestCLICommandRunsProjectFromCurrentDirectory(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "noEmit": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export const value = 1;
`)

  code, out, errOut := runBuiltNativeCommandInDir(t, root)
  if code != 0 {
    t.Fatalf("bare command should build cwd project: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  if strings.Contains(out, "Usage:") {
    t.Fatalf("bare command should not print help usage: %q", out)
  }
}
