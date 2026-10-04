package driver_test

import (
  "crypto/sha256"
  "encoding/hex"
  "path/filepath"
  "slices"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestTransformGraphReportsSupersedingModuleCandidates Verifies resolution candidates and their input proofs.
//
// The direct graph operation must retain probes that can supersede a selected
// JavaScript source and reject lower-priority probes. Missing inputs carry
// null proofs, while the selected source carries its authored-byte digest.
//
// 1. Load an extensionless import selecting the authored value.js file.
// 2. Construct the transform graph directly from that Program.
// 3. Check ts inclusion, jsx exclusion, missing proofs and the selected hash/path.
//
// @evidence contracts/testing.md#behavioral-verification NewTransformGraph includes the higher-priority ts candidate, excludes jsx, records null missing proofs and the selected JavaScript SHA256 plus absolute physical path.
// @evidence contracts/testing.md#independent-expectations The authored JavaScript bytes independently determine the SHA256, and resolution precedence establishes which sibling can supersede the winner.
// @evidence contracts/testing.md#distinguishing-cases A missing ts sibling, selected js file and lower-priority jsx probe distinguish candidate inclusion, missing proof and actual-content proof.
// @evidence contracts/testing.md#execution-ownership Go test/driver loads and graphs a fixture Program directly; it inspects the envelope representation without crossing the native-to-JavaScript transport.
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
  physical, err := filepath.EvalSymlinks(filepath.Join(root, "src", "value.js"))
  if err != nil {
    t.Fatal(err)
  }
  if *graph.InputRealpaths[selected] != filepath.Clean(physical) {
    t.Fatalf("selected source realpath = %q, want %q", *graph.InputRealpaths[selected], filepath.Clean(physical))
  }
}
