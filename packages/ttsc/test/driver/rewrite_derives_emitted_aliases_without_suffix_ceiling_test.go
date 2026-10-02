package driver_test

import (
  "fmt"
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverRewriteDerivesEmittedAliasesWithoutSuffixCeiling Verifies rewrites follow the actual CommonJS binding at every authored collision depth.
//
// The driver used to enumerate only the bare root, `_1`, and `_2`. That made a
// valid default import fail as soon as ordinary locals pushed the emitter to
// `_3`. The suffix-16 case distinguishes the old small enumeration from a
// repair tested only at the adjacent boundary; these finite cases do not by
// themselves prove an unbounded suffix range.
//
// 1. Emit the bare-root and default-import fixtures at suffixes 0, 1, 2, 3 and 16.
// 2. Register each source-level rewrite and inspect the actual nonambient import binding.
// 3. Require each literal exported replacement; the same five runtime identities live in the E2E batch.
//
// @evidence contracts/testing.md#behavioral-verification Each named Go subtest runs actual driver emission, checks its nonambient suffix binding and requires the independently named exported replacement.
// @evidence contracts/testing.md#independent-expectations Authored collision counts establish plugin_1, plugin_2, plugin_3 and plugin_16; the bare-root case and literal rewritten-case names are independent controls.
// @evidence contracts/testing.md#distinguishing-cases Ambient bare root, no collision, adjacent collisions and fifteen locals distinguish finite suffix guesses from declaration-derived aliases.
// @evidence contracts/testing.md#execution-ownership These five driver unit subcases invoke the compiler directly and inspect output; TestDriverRewriteRuntimeBatch separately loads all five artifacts in one Node process.
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
      if !strings.Contains(js, fmt.Sprintf("exports.value = %q;", want)) {
        t.Fatalf("rewritten export missing %q:\n%s", want, js)
      }
    })
  }
}
