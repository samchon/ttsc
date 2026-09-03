package driver_test

import (
  "os"
  "os/exec"
  "path/filepath"
  "runtime"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestModuleResolutionReplayRetainsASymlinkedWinner verifies exact resolver
// replay retains a selected lexical alias while excluding probes below it.
func TestModuleResolutionReplayRetainsASymlinkedWinner(t *testing.T) {
  root := t.TempDir()
  real := filepath.Join(root, "real")
  if err := os.MkdirAll(real, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(filepath.Join(real, "value.js"), []byte("export function winner() {}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  link := filepath.Join(root, "link")
  if runtime.GOOS == "windows" {
    command := exec.Command("node", "-e", `require("node:fs").symlinkSync(process.argv[1], process.argv[2], "junction")`, real, link)
    if output, err := command.CombinedOutput(); err != nil {
      t.Skipf("directory junction unavailable on this host: %v: %s", err, output)
    }
  } else if err := os.Symlink(real, link); err != nil {
    t.Skipf("directory symlink unavailable on this host: %v", err)
  }
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "allowJs": true, "module": "commonjs", "target": "es2022" },
  "files": ["src/main.ts"]
}`)
  writeProjectFile(t, root, "src/main.ts", "import { winner } from '../link/value';\nexport function main(): void { winner(); }\n")

  prog, diagnostics, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{ForceNoEmit: true})
  if err != nil {
    t.Fatal(err)
  }
  if len(diagnostics) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diagnostics)
  }
  defer prog.Close()
  graph := driver.NewTransformGraph(prog, root)
  candidates := graph.Candidates[filepath.ToSlash(filepath.Join("src", "main.ts"))]
  if !slices.Contains(candidates, filepath.ToSlash(filepath.Join("link", "value.ts"))) {
    t.Fatalf("missing higher-priority lexical candidate: %v", candidates)
  }
  if !slices.Contains(candidates, filepath.ToSlash(filepath.Join("link", "value.js"))) {
    t.Fatalf("missing selected lexical alias: %v", candidates)
  }
  if slices.Contains(candidates, filepath.ToSlash(filepath.Join("link", "value.jsx"))) {
    t.Fatalf("probe below the winner must not be tracked: %v", candidates)
  }
}
