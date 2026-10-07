package driver_test

import (
  "testing"

  shimcore "github.com/microsoft/typescript-go/shim/core"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverLoadProgramClampsCheckerPoolToOne Verifies forceSingleChecker
// collapses a multi-checker pool request down to a single checker.
//
// The driver selects a single checker for its transform/rewrite phases even
// when the caller requests a larger pool. A separate SingleThreaded request
// remains intact. This case inspects those option policies; it does not query
// cross-file types or certify the behavior of a multi-checker pool.
//
// 1. Load a multi-file project with LoadProgramOptions.Checkers set to 4.
// 2. Assert the resolved CompilerOptions.Checkers is clamped to exactly 1.
// 3. Load the same project with SingleThreaded and assert it still applies.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram resolves a requested checker count of four to one and preserves a separately requested SingleThreaded option.
// @evidence contracts/testing.md#independent-expectations The driver single-checker policy supplies the literal one expectation; inspecting options does not independently prove cross-file type query correctness.
// @evidence contracts/testing.md#distinguishing-cases A multi-file project exercises explicit multi-checker clamping and the adjacent SingleThreaded policy branch.
// @evidence contracts/testing.md#execution-ownership Go test/driver creates and closes two in-process Programs and reads their parsed options without building a host.
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
