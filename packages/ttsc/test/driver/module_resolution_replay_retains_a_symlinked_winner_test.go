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

// TestModuleResolutionReplayRetainsASymlinkedWinner Verifies exact resolver
// replay retains a selected lexical alias while excluding probes below it.
//
// A lexical directory alias must remain in the resolver candidate proof even
// when the selected file has a different physical spelling. Unsupported link
// preparation is a capability skip, not a successful assertion.
//
// 1. Prepare a JavaScript winner behind a directory symlink or junction.
// 2. Load the importer directly and construct its transform graph.
// 3. Require lexical ts/js candidates and exclude the lower-priority jsx probe.
//
// @evidence contracts/testing.md#behavioral-verification NewTransformGraph retains lexical link/value.ts and selected link/value.js candidates while excluding link/value.jsx after a direct Program load.
// @evidence contracts/testing.md#independent-expectations The fixture chooses value.js behind a lexical alias; TypeScript resolution precedence requires the higher-priority ts probe and excludes the lower-priority jsx probe.
// @evidence contracts/testing.md#distinguishing-cases Directory alias plus a JavaScript winner owns lexical replay; hosts without symlink or junction capability skip this distinction explicitly.
// @evidence contracts/testing.md#execution-ownership Go test/driver loads and graphs the fixture in process; Windows Node only prepares a junction and does not run emitted product code or a host.
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
