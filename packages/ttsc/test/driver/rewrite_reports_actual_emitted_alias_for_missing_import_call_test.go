package driver_test

import (
  "fmt"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteReportsActualEmittedAliasForMissingImportCall verifies the
// missing-call diagnostic retains source ownership and reports the real alias.
//
// Alias discovery must not turn an absent target into a silent pass or a decoy
// rewrite. A high-suffix import with a different method therefore still fails,
// but its diagnostic now names the declaration TypeScript-Go actually emitted.
//
// 1. Emit a default import at `_16` whose only call uses another method.
// 2. Register a rewrite for the missing `plugin.make` call.
// 3. Assert emit fails with the source call and actual emitted alias in the error.
func TestDriverRewriteReportsActualEmittedAliasForMissingImportCall(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "outDir": "bin",
    "strict": true
  },
  "files": ["index.ts", "plugin.ts"]
}
`)
  writeProjectFile(t, root, "plugin.ts", `export default {
  other(input: string): string {
    return input;
  }
};
`)
  var source strings.Builder
  for i := 1; i < 16; i++ {
    fmt.Fprintf(&source, "const plugin_%d = %d;\n", i, i)
  }
  source.WriteString(`import plugin from "./plugin";
export const value = plugin.other("input");
`)
  writeProjectFile(t, root, "index.ts", source.String())

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected config diagnostics: %#v", diags)
  }
  defer prog.Close()
  file := prog.SourceFile(filepath.Join(root, "index.ts"))
  if file == nil {
    t.Fatal("SourceFile did not find index.ts")
  }
  rewrites := driver.NewRewriteSet()
  rewrites.Add(driver.Rewrite{
    File:          file,
    RootName:      "plugin",
    Method:        "make",
    Replacement:   `"unreachable"`,
    ConsumeParens: true,
  })
  _, emitDiags, err := prog.EmitAll(rewrites, nil)
  messages := []string{}
  if err != nil {
    messages = append(messages, err.Error())
  }
  for _, diag := range emitDiags {
    messages = append(messages, diag.String())
  }
  message := strings.Join(messages, "\n")
  for _, want := range []string{"could not locate plugin.make", "tried roots [plugin_16.default]", "index.js"} {
    if !strings.Contains(message, want) {
      t.Fatalf("diagnostic missing %q: %s", want, message)
    }
  }
}
