package ttsc_test

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/utility"
)

// TestUtilityStripForInForOfEmbeddedStatements verifies strip handling for
// unbraced `for in` and `for of` statement bodies.
//
// These loops use a shared AST node shape in the host. The strip plugin should
// replace removed embedded statements with empty statements while preserving the
// loop shells for valid emitted JavaScript.
//
// 1. Create a project with stripped statements as `for in` and `for of` bodies.
// 2. Emit with the default strip utility plugin configuration.
// 3. Assert stripped calls/debuggers are gone while both loops remain.
func TestUtilityStripForInForOfEmbeddedStatements(t *testing.T) {
  root := t.TempDir()

  // Scenario setup: default strip config removes console.log and debugger, so
  // no custom plugin configuration is needed to reach these embedded branches.
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin"
  },
  "files": ["index.ts"]
}
`)
  writeProjectFile(t, root, "index.ts", `export function run(record: Record<string, number>, list: number[]): number {
  for (const key in record) console.log(key);
  for (const value of list) debugger;
  return Object.keys(record).length + list.length;
}
`)

  // Build assertion: loop bodies should be stripped without deleting the loop
  // nodes or leaving the original debug statements behind.
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
  for _, forbidden := range []string{"console.log", "debugger"} {
    if strings.Contains(text, forbidden) {
      t.Fatalf("strip plugin left %s in emitted JavaScript:\n%s", forbidden, text)
    }
  }
  for _, required := range []string{"for (const key in record)", "for (const value of list)"} {
    if !strings.Contains(text, required) {
      t.Fatalf("strip plugin removed loop shell %s from emitted JavaScript:\n%s", required, text)
    }
  }
}
