package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityStripEmbeddedStatements verifies the strip plugin handles
// single-statement control-flow bodies, not just top-level statements.
//
// This utility regression runs through the package-level host fixture rather
// than a production-package test file. The assertions keep plugin behavior
// tied to observable transform output or diagnostics.
//
// 1. Create a project with debugger and configured calls inside control flow.
// 2. Run a utility build with the strip plugin defaults.
// 3. Assert emitted JavaScript has no stripped debug statements left.
func TestUtilityStripEmbeddedStatements(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: unbraced branches exercise filterEmbeddedStatement, which
  // replaces removed statements with synthesized empty statements.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `declare const assert: { fail(message: string): void };
export function run(flag: boolean): number {
  if (flag) console.log("if");
  else debugger;
  while (flag) console.debug("while");
  for (; flag;) assert.fail("for");
  do debugger; while (false);
  label: console.log("label");
  return 1;
}
`)

  // Build assertion: no stripped call names or debugger statements should
  // remain after AST filtering and TypeScript emit.
  code, out, errOut := captureUtilityOutput(t, func() int {
    return utility.RunBuild([]string{
      "--cwd", root,
      "--emit",
      "--plugins-json", `[{"name":"@ttsc/strip"}]`,
    })
  })
  if code != 0 {
    t.Fatalf("RunBuild failed: code=%d stdout=%q stderr=%q", code, out, errOut)
  }
  js, err := os.ReadFile(filepath.Join(root, "bin", "index.js"))
  if err != nil {
    t.Fatal(err)
  }
  text := string(js)
  for _, forbidden := range []string{"console.log", "console.debug", "assert.fail", "debugger"} {
    if strings.Contains(text, forbidden) {
      t.Fatalf("strip plugin left %s in emitted JavaScript:\n%s", forbidden, text)
    }
  }
}
