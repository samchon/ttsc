package linthost

import (
  "path/filepath"
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"
)

// TestLoadProgramClampsCheckerPoolToOne verifies forceSingleChecker collapses a
// multi-checker pool request down to a single checker in the lint host.
//
// PR #112 dropped SingleThreaded, which switched on TypeScript-Go's
// multi-checker pool. Type-aware lint rules walk files serially and resolve
// types through the one checker GetTypeChecker hands back, so a pool larger
// than one lets a type whose declarations span files on different checkers
// resolve to `any`. loadProgram must therefore clamp `Checkers` back to 1 for
// type-aware rules, while leaving `--singleThreaded` untouched so that path
// still wins.
//
// 1. loadProgram a multi-file project with checkers=8 and needsRuleChecker.
// 2. Assert the resolved CompilerOptions.Checkers is clamped to exactly 1.
// 3. loadProgram the same project with singleThreaded and assert it still applies.
func TestLoadProgramClampsCheckerPoolToOne(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/a.ts", "src/b.ts", "src/main.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "a.ts"), "export const a = 1;\n")
  writeFile(t, filepath.Join(root, "src", "b.ts"), "export const b = 2;\n")
  writeFile(t, filepath.Join(root, "src", "main.ts"),
    "import { a } from \"./a\";\nimport { b } from \"./b\";\nexport const sum = a + b;\n")

  pooled, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    checkers:         8,
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer pooled.close()

  checkers := pooled.parsed.ParsedConfig.CompilerOptions.Checkers
  if checkers == nil {
    t.Fatal("forceSingleChecker did not pin Checkers; it is still nil (multi-checker default)")
  }
  if *checkers != 1 {
    t.Fatalf("forceSingleChecker did not clamp the pool: Checkers = %d, want 1", *checkers)
  }

  single, diags, err := loadProgram(root, "tsconfig.json", loadProgramOptions{
    singleThreaded:   true,
    needsRuleChecker: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer single.close()

  if single.parsed.ParsedConfig.CompilerOptions.SingleThreaded != shimcore.TSTrue {
    t.Fatal("forceSingleChecker clobbered --singleThreaded; SingleThreaded is not set")
  }
}
