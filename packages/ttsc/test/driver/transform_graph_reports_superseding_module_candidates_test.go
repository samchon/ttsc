package driver_test

import (
  "crypto/sha256"
  "encoding/hex"
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTransformGraphReportsSupersedingModuleCandidates verifies the transform
// envelope carries only the candidate paths that precede a resolved module
// target.
//
// Bundler caches must hash a missing .ts sibling of a selected .js module, but
// a lower-priority .jsx sibling must not invalidate them. The envelope is the
// native-to-JavaScript boundary where that distinction has to survive.
//
//  1. Load an extensionless import whose selected target is value.js.
//  2. Build the host-owned transform graph from that loaded program.
//  3. Assert candidates include value.ts and exclude the lower-priority
//     value.jsx sibling.
func TestTransformGraphReportsSupersedingModuleCandidates(t *testing.T) {
  root := t.TempDir()
  writeProjectFile(t, root, "tsconfig.json", `{
  "compilerOptions": { "allowJs": true, "module": "commonjs", "target": "es2022" },
  "files": ["src/main.ts"]
}
`)
  writeProjectFile(t, root, "src/main.ts", "import { winner } from './value';\nexport function main(): void { winner(); }\n")
  writeProjectFile(t, root, "src/value.js", "export function winner() {}\n")

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{
    ForceNoEmit: true,
  })
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %#v", diags)
  }
  defer prog.Close()

  graph := driver.NewTransformGraph(prog, root)
  if graph == nil {
    t.Fatal("NewTransformGraph returned nil for a loaded program")
  }
  candidates := graph.Candidates["src/main.ts"]
  if !slices.Contains(candidates, filepath.ToSlash(filepath.Join("src", "value.ts"))) {
    t.Fatalf("missing higher-priority value.ts candidate: %v", candidates)
  }
  if slices.Contains(candidates, filepath.ToSlash(filepath.Join("src", "value.jsx"))) {
    t.Fatalf("lower-priority value.jsx candidate must not be tracked: %v", candidates)
  }
  missing := filepath.ToSlash(filepath.Join("src", "value.ts"))
  if hash, ok := graph.InputHashes[missing]; !ok || hash != nil {
    t.Fatalf("missing candidate proof = %#v, %v; want explicit null", hash, ok)
  }
  if realpath, ok := graph.InputRealpaths[missing]; !ok || realpath != nil {
    t.Fatalf("missing candidate realpath = %#v, %v; want explicit null", realpath, ok)
  }
  selected := filepath.ToSlash(filepath.Join("src", "value.js"))
  digest := sha256.Sum256([]byte("export function winner() {}\n"))
  if hash := graph.InputHashes[selected]; hash == nil || *hash != hex.EncodeToString(digest[:]) {
    t.Fatalf("selected source proof = %#v, want %s", hash, hex.EncodeToString(digest[:]))
  }
  if realpath := graph.InputRealpaths[selected]; realpath == nil || !filepath.IsAbs(*realpath) {
    t.Fatalf("selected source realpath = %#v, want absolute", realpath)
  }
}
