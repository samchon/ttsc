package driver_test

import (
  "context"
  "sync/atomic"
  "testing"

  shimchecker "github.com/microsoft/typescript-go/shim/checker"
  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestDriverBatchNoEmitUsesCheckerPoolAndPinsAllOtherLoads verifies that
// loadProgram leaves TypeScript-Go's checker pool unpinned only for a one-shot
// no-emit load under TTSC_BATCH=1 that is not single-threaded, and pins every
// other load to one checker.
//
//  1. Load an eight-file project under TTSC_BATCH=1 with ForceNoEmit and assert
//     the TSProgram pool has more than one checker and assigns more than one
//     distinct checker across source files.
//  2. Load with tsconfig noEmit:true under TTSC_BATCH=1 and assert >1 checker,
//     and with explicit Checkers:2 assert exactly 2 checkers.
//  3. Load under TTSC_BATCH=1 with SingleThreaded:true and assert 1 checker.
//  4. Load under TTSC_BATCH=1 with emit enabled (both default tsconfig and
//     ForceEmit overriding tsconfig noEmit:true) and assert 1 checker.
//  5. Load via driver.NewSession under TTSC_BATCH=1 with ForceNoEmit and assert
//     1 checker.
//  6. Load without TTSC_BATCH=1 (unset and "0") with ForceNoEmit and assert 1
//     checker.
//
// @evidence contracts/testing.md#behavioral-verification Exercises real LoadProgram and NewSession across all pooling conditions, inspecting the live TSProgram pool via ForEachCheckerParallel and per-file GetTypeCheckerForFile.
// @evidence contracts/testing.md#independent-expectations The batch-pooling contract defines the exact four conditions (allowBatch, TTSC_BATCH=1, effective noEmit, not single-threaded) and requires >1 checker when all hold (matching requested Checkers when given) and 1 checker whenever any fails.
// @evidence contracts/testing.md#distinguishing-cases Covers ForceNoEmit, tsconfig noEmit, explicit Checkers:2, SingleThreaded override, emit enabled, ForceEmit overriding tsconfig noEmit, resident NewSession and missing/non-"1" TTSC_BATCH marker; emit refusal and cross-file circular-alias resolution are owned by sibling tests.
// @evidence contracts/testing.md#execution-ownership Discoverable Go unit in package driver_test using in-process LoadProgram and NewSession over temporary projects; no native binary or consumer install runs.
func TestDriverBatchNoEmitUsesCheckerPoolAndPinsAllOtherLoads(t *testing.T) {
  emitRoot := writeCrossFileCircularAliasProject(t)
  noEmitRoot := writeNoEmitMultiFileProject(t)

  t.Run("batch ForceNoEmit uses checker pool", func(t *testing.T) {
    t.Setenv(shimcompiler.BatchEnv, "1")
    prog, diags, err := driver.LoadProgram(emitRoot, "tsconfig.json", driver.LoadProgramOptions{
      ForceNoEmit: true,
    })
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("LoadProgram: prog=%v diags=%#v err=%v", prog, diags, err)
    }
    defer prog.Close()

    if count := liveCheckerPoolSize(prog.TSProgram); count <= 1 {
      t.Fatalf("pooled ForceNoEmit checker pool size = %d, want > 1", count)
    }
    if distinct := distinctFileCheckerCount(prog.TSProgram); distinct <= 1 {
      t.Fatalf("pooled ForceNoEmit distinct file checkers = %d, want > 1", distinct)
    }
  })

  t.Run("batch tsconfig noEmit uses checker pool and honors explicit Checkers", func(t *testing.T) {
    t.Setenv(shimcompiler.BatchEnv, "1")
    prog, diags, err := driver.LoadProgram(noEmitRoot, "tsconfig.json", driver.LoadProgramOptions{})
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("LoadProgram: prog=%v diags=%#v err=%v", prog, diags, err)
    }
    defer prog.Close()

    if count := liveCheckerPoolSize(prog.TSProgram); count <= 1 {
      t.Fatalf("pooled tsconfig noEmit checker pool size = %d, want > 1", count)
    }

    two, diags, err := driver.LoadProgram(noEmitRoot, "tsconfig.json", driver.LoadProgramOptions{
      Checkers: 2,
    })
    if err != nil || len(diags) != 0 || two == nil {
      t.Fatalf("LoadProgram(Checkers=2): prog=%v diags=%#v err=%v", two, diags, err)
    }
    defer two.Close()

    if count := liveCheckerPoolSize(two.TSProgram); count != 2 {
      t.Fatalf("pooled Checkers=2 pool size = %d, want 2", count)
    }
  })

  t.Run("batch ForceNoEmit with SingleThreaded stays single-checker", func(t *testing.T) {
    t.Setenv(shimcompiler.BatchEnv, "1")
    prog, diags, err := driver.LoadProgram(emitRoot, "tsconfig.json", driver.LoadProgramOptions{
      ForceNoEmit:    true,
      SingleThreaded: true,
      Checkers:       4,
    })
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("LoadProgram: prog=%v diags=%#v err=%v", prog, diags, err)
    }
    defer prog.Close()

    if count := liveCheckerPoolSize(prog.TSProgram); count != 1 {
      t.Fatalf("SingleThreaded checker pool size = %d, want 1", count)
    }
  })

  t.Run("batch with emit enabled stays single-checker", func(t *testing.T) {
    t.Setenv(shimcompiler.BatchEnv, "1")
    prog, diags, err := driver.LoadProgram(emitRoot, "tsconfig.json", driver.LoadProgramOptions{
      Checkers: 4,
    })
    if err != nil || len(diags) != 0 || prog == nil {
      t.Fatalf("LoadProgram(emit): prog=%v diags=%#v err=%v", prog, diags, err)
    }
    defer prog.Close()

    if count := liveCheckerPoolSize(prog.TSProgram); count != 1 {
      t.Fatalf("batch emit checker pool size = %d, want 1", count)
    }

    forced, diags, err := driver.LoadProgram(noEmitRoot, "tsconfig.json", driver.LoadProgramOptions{
      ForceEmit: true,
      Checkers:  4,
    })
    if err != nil || len(diags) != 0 || forced == nil {
      t.Fatalf("LoadProgram(ForceEmit): prog=%v diags=%#v err=%v", forced, diags, err)
    }
    defer forced.Close()

    if count := liveCheckerPoolSize(forced.TSProgram); count != 1 {
      t.Fatalf("batch ForceEmit checker pool size = %d, want 1", count)
    }
  })

  t.Run("Session under TTSC_BATCH=1 stays single-checker", func(t *testing.T) {
    t.Setenv(shimcompiler.BatchEnv, "1")
    sess, diags, err := driver.NewSession(emitRoot, "tsconfig.json", driver.LoadProgramOptions{
      ForceNoEmit: true,
      Checkers:    4,
    })
    if err != nil || len(diags) != 0 || sess == nil {
      t.Fatalf("NewSession: sess=%v diags=%#v err=%v", sess, diags, err)
    }
    defer sess.Close()

    if count := liveCheckerPoolSize(sess.Program().TSProgram); count != 1 {
      t.Fatalf("Session checker pool size = %d, want 1", count)
    }
  })

  t.Run("without TTSC_BATCH=1 ForceNoEmit stays single-checker", func(t *testing.T) {
    for _, marker := range []string{"", "0"} {
      t.Setenv(shimcompiler.BatchEnv, marker)
      prog, diags, err := driver.LoadProgram(emitRoot, "tsconfig.json", driver.LoadProgramOptions{
        ForceNoEmit: true,
        Checkers:    4,
      })
      if err != nil || len(diags) != 0 || prog == nil {
        t.Fatalf("LoadProgram(marker=%q): prog=%v diags=%#v err=%v", marker, prog, diags, err)
      }
      count := liveCheckerPoolSize(prog.TSProgram)
      _ = prog.Close()
      if count != 1 {
        t.Fatalf("unmarked(marker=%q) ForceNoEmit checker pool size = %d, want 1", marker, count)
      }
    }
  })
}

func liveCheckerPoolSize(program *shimcompiler.Program) int {
  var count atomic.Int32
  program.ForEachCheckerParallel(func(_ int, _ *shimchecker.Checker) {
    count.Add(1)
  })
  return int(count.Load())
}

func distinctFileCheckerCount(program *shimcompiler.Program) int {
  ctx := context.Background()
  seen := map[*shimchecker.Checker]struct{}{}
  for _, sf := range program.SourceFiles() {
    if sf == nil || sf.IsDeclarationFile {
      continue
    }
    c, done := program.GetTypeCheckerForFile(ctx, sf)
    if c != nil {
      seen[c] = struct{}{}
    }
    if done != nil {
      done()
    }
  }
  return len(seen)
}

func writeNoEmitMultiFileProject(t *testing.T) string {
  t.Helper()
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": {
    "target": "es2022",
    "module": "commonjs",
    "strict": true,
    "noEmit": true,
    "types": []
  },
  "files": [
    "src/a.ts",
    "src/b.ts",
    "src/c.ts",
    "src/d.ts",
    "src/e.ts",
    "src/f.ts",
    "src/g.ts",
    "src/h.ts"
  ]
}
`)
  for _, name := range []string{"a", "b", "c", "d", "e", "f", "g", "h"} {
    writeProjectFile(t, root, "src/"+name+".ts", "export const v_"+name+": string = \""+name+"\";\n")
  }
  return root
}
