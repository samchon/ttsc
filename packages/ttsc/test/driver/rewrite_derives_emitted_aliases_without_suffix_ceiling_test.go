package driver_test

import (
  "fmt"
  "os/exec"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling verifies rewrites
// follow TypeScript-Go's actual CommonJS binding at every collision depth.
//
// The driver used to enumerate only the bare root, `_1`, and `_2`. That made a
// valid default import fail as soon as ordinary locals pushed the emitter to
// `_3`; a substantially higher case proves the repair has no new finite cap.
//
// 1. Compile bare-root and default-import cases for suffixes 0, 1, 2, 3, and 16.
// 2. Register the same source-level rewrite through the public driver API.
// 3. Assert the actual emitted alias, successful emit, and rewritten runtime value.
func TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling(t *testing.T) {
  cases := []struct {
    name       string
    suffix     int
    collisions int
    ambient    bool
  }{
    {name: "suffix_0_bare_root", suffix: 0, ambient: true},
    {name: "suffix_1", suffix: 1},
    {name: "suffix_2", suffix: 2, collisions: 1},
    {name: "suffix_3", suffix: 3, collisions: 2},
    {name: "suffix_16", suffix: 16, collisions: 15},
  }
  for _, test := range cases {
    t.Run(test.name, func(t *testing.T) {
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
  make(input: string): string {
    return "plugin:" + input;
  }
};
`)
      var source strings.Builder
      if test.ambient {
        source.WriteString("declare const plugin: { make(input: string): string };\n")
      } else {
        for i := 1; i <= test.collisions; i++ {
          fmt.Fprintf(&source, "const plugin_%d = %d;\n", i, i)
        }
        source.WriteString(`import plugin from "./plugin";
`)
      }
      source.WriteString(`export const value = plugin.make("input");
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
      want := "rewritten-" + test.name
      rewrites.Add(driver.Rewrite{
        File:          file,
        RootName:      "plugin",
        Method:        "make",
        Replacement:   fmt.Sprintf("%q", want),
        ConsumeParens: true,
      })
      _, emitDiags, err := prog.EmitAll(rewrites, nil)
      if err != nil {
        t.Fatal(err)
      }
      if len(emitDiags) != 0 {
        t.Fatalf("unexpected emit diagnostics: %#v", emitDiags)
      }
      jsPath := filepath.Join(root, "bin", "index.js")
      js := readFileForTest(t, jsPath)
      if !test.ambient {
        binding := regexp.MustCompile(`const (plugin(?:_\d+)?) = __importDefault\(require\("\./plugin"\)\);`).FindStringSubmatch(js)
        expected := fmt.Sprintf("plugin_%d", test.suffix)
        if len(binding) != 2 || binding[1] != expected {
          t.Fatalf("emitted binding mismatch: got %v, want %q\n%s", binding, expected, js)
        }
      }
      command := exec.Command("node", "-e", `process.stdout.write(String(require("./index.js").value))`)
      command.Dir = filepath.Dir(jsPath)
      output, err := command.CombinedOutput()
      if err != nil {
        t.Fatalf("rewritten JavaScript failed: %v\n%s", err, output)
      }
      if string(output) != want {
        t.Fatalf("runtime value = %q, want %q\n%s", output, want, js)
      }
    })
  }
}
