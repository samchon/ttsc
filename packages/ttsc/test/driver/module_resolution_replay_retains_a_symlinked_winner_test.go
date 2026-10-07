package driver_test

import (
  "os"
  "path/filepath"
  "runtime"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestModuleResolutionReplayRetainsASymlinkedWinner Verifies exact resolver
// replay retains a selected lexical alias while excluding probes below it.
//
// A lexical directory alias must remain in the resolver candidate proof even
// when the selected file has a different physical spelling. Link preparation
// is required on the selected platform and failure fails this case.
//
// 1. Prepare a JavaScript winner behind a directory symlink or junction.
// 2. Load the importer directly and construct its transform graph.
// 3. Require lexical ts/js candidates and exclude the lower-priority jsx probe.
//
// @evidence contracts/testing.md#behavioral-verification NewTransformGraph retains lexical link/value.ts and selected link/value.js candidates while excluding link/value.jsx after a direct Program load.
// @evidence contracts/testing.md#independent-expectations The fixture chooses value.js behind a lexical alias; TypeScript resolution precedence requires the higher-priority ts probe and excludes the lower-priority jsx probe.
// @evidence contracts/testing.md#distinguishing-cases Directory alias plus a JavaScript winner owns lexical replay; failed alias preparation is a test failure rather than skipped coverage.
// @evidence contracts/testing.md#execution-ownership Go test/driver loads and graphs the fixture in process; Windows uses the maintained windowsjunction.Create native cmd boundary only for preparation, while other platforms call os.Symlink. No emitted product code or host is run.
func TestModuleResolutionReplayRetainsASymlinkedWinner(t *testing.T) {
  t.Setenv(driver.TsgoArgsEnv, "")
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
    if err := windowsjunction.Create(link, real); err != nil {
      t.Fatalf("prepare directory junction: %v", err)
    }
  } else if err := os.Symlink(real, link); err != nil {
    t.Fatalf("prepare directory symlink: %v", err)
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
