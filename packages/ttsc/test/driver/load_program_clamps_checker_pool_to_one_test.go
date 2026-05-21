package driver_test

import (
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramClampsCheckerPoolToOne verifies forceSingleChecker
// collapses a multi-checker pool request down to a single checker.
//
// PR #112 dropped SingleThreaded, which switched on TypeScript-Go's
// multi-checker pool. ttsc's transform and rewrite phases query types through
// the one checker GetTypeChecker hands back, so a pool larger than one lets a
// type whose declarations span files on different checkers resolve to `any`.
// forceSingleChecker must therefore clamp `Checkers` back to 1 even when the
// caller (or `--checkers N`) asked for more, while leaving `--singleThreaded`
// untouched so that path still wins.
//
// 1. Load a multi-file project with LoadProgramOptions.Checkers set to 4.
// 2. Assert the resolved CompilerOptions.Checkers is clamped to exactly 1.
// 3. Load the same project with SingleThreaded and assert it still applies.
func TestDriverLoadProgramClampsCheckerPoolToOne(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "module": "commonjs",
    "target": "es2020",
    "strict": true,
    "outDir": "bin"
  },
  "files": ["a.ts", "b.ts", "index.ts"]
}
`)
  writeProjectFile(t, root, "a.ts", "export const a = 1;\n")
  writeProjectFile(t, root, "b.ts", "export const b = 2;\n")
  writeProjectFile(t, root, "index.ts", "import { a } from \"./a\";\nimport { b } from \"./b\";\nexport const sum = a + b;\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    Checkers: 4,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  checkers := prog.ParsedConfig.ParsedConfig.CompilerOptions.Checkers
  if checkers == nil {
    t.Fatal("forceSingleChecker did not pin Checkers; it is still nil (multi-checker default)")
  }
  if *checkers != 1 {
    t.Fatalf("forceSingleChecker did not clamp the pool: Checkers = %d, want 1", *checkers)
  }

  single, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    SingleThreaded: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer single.Close()

  if single.ParsedConfig.ParsedConfig.CompilerOptions.SingleThreaded != shimcore.TSTrue {
    t.Fatal("forceSingleChecker clobbered --singleThreaded; SingleThreaded is not set")
  }
}
