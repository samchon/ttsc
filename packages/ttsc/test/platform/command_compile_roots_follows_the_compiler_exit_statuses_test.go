package ttsc_test

import (
  "encoding/json"
  "os"
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestCommandCompileRootsFollowsTheCompilerExitStatuses verifies compile-roots
// reports a type error the way TypeScript-Go's command line does.
//
// The launcher reads this command exactly as it reads the compiler it stands in
// for. A checked ttsx entry passes `--noEmitOnError` and fails on any non-zero
// status; an installed package's root is emit-only and succeeds when it wrote
// JavaScript despite its own type errors. Each lane depends on one row of the
// compiler's table: diagnostics with outputs exit 1, diagnostics without
// outputs exit 2, and the diagnostic itself is printed. A request with no roots
// is refused rather than compiling the whole project.
//
// 1. Build a project whose root outside `include` has a type error.
// 2. Run compile-roots plainly, with `--noEmitOnError`, with `--noEmit`, and
//    with no roots named.
// 3. Assert the status, the printed diagnostic, and whether JavaScript was
//    written for each.
func TestCommandCompileRootsFollowsTheCompilerExitStatuses(t *testing.T) {
  root := t.TempDir()
  writePlatformProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "module": "commonjs", "target": "es2022", "strict": true },
  "include": ["src"]
}
`)
  writePlatformProjectFile(t, root, "scripts/run.ts", "export const broken: number = \"text\";\n")
  payload, err := json.Marshal([]string{filepath.Join(root, "scripts", "run.ts")})
  if err != nil {
    t.Fatal(err)
  }

  cases := []struct {
    name    string
    extra   []string
    code    int
    emitted bool
  }{
    {name: "emit despite diagnostics", code: 1, emitted: true},
    {name: "noEmitOnError", extra: []string{"--noEmitOnError"}, code: 2, emitted: false},
    {name: "noEmit", extra: []string{"--noEmit"}, code: 2, emitted: false},
  }
  for _, c := range cases {
    t.Run(c.name, func(t *testing.T) {
      t.Setenv(driver.RootFilesEnv, string(payload))
      out := t.TempDir()
      args := append([]string{
        "compile-roots",
        "-p", filepath.Join(root, "tsconfig.json"),
        "--rootDir", root,
        "--outDir", out,
      }, c.extra...)
      code, stdout, stderr := runPlatformCommand(t, args...)
      if code != c.code {
        t.Fatalf("code=%d, want %d: stdout=%q stderr=%q", code, c.code, stdout, stderr)
      }
      if !strings.Contains(stdout, "TS2322") {
        t.Fatalf("the type error was not reported: %q", stdout)
      }
      _, err := os.Stat(filepath.Join(out, "scripts", "run.js"))
      if emitted := err == nil; emitted != c.emitted {
        t.Fatalf("emitted=%v, want %v", emitted, c.emitted)
      }
    })
  }

  t.Run("no roots named", func(t *testing.T) {
    t.Setenv(driver.RootFilesEnv, "")
    out := t.TempDir()
    code, _, stderr := runPlatformCommand(
      t,
      "compile-roots",
      "-p", filepath.Join(root, "tsconfig.json"),
      "--outDir", out,
    )
    if code != 2 || !strings.Contains(stderr, driver.RootFilesEnv) {
      t.Fatalf("a request without roots was not refused: code=%d stderr=%q", code, stderr)
    }
    if entries, _ := os.ReadDir(out); len(entries) != 0 {
      t.Fatal("a request without roots compiled the project")
    }
  })
}
