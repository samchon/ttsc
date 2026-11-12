package driver

import (
  "crypto/sha256"
  "encoding/hex"
  "os"
  "path/filepath"
  "slices"
  "testing"
)

// TestCompilerObservationsReportEveryPredicate Verifies a loaded Program reports
// every filesystem question the compiler asked, not only the input classes a
// reference graph names.
//
// A host that proves a stored result without asking the compiler again needs
// the answers that selected the Program as much as the sources it read: the
// directory a root pattern expanded, and the higher-priority candidate that was
// absent when an import resolved (samchon/ttsc#1852).
//
//  1. Load a project whose root pattern expands a directory and whose import
//     resolves past a missing candidate.
//  2. Read the Program's complete observations after emit.
//  3. Assert the read source's hash, the expanded directory's members, the
//     missing candidate's absence and the population's completeness.
//
// @evidence contracts/testing.md#behavioral-verification An actual loaded and emitted Program reports its observer population; the assertions read the reported predicates for a source, a pattern-expanded directory and a resolution candidate that did not exist.
// @evidence contracts/testing.md#independent-expectations The expected digest is crypto/sha256 of the authored source text, the expected members are the authored file names, and the candidate is known absent because the test never creates it.
// @evidence contracts/testing.md#distinguishing-cases A read file, an enumerated directory and an absent higher-priority candidate are three predicate kinds; the last two are exactly what a source-only projection omits. A nil Program reports nothing and no completeness.
// @evidence contracts/testing.md#execution-ownership Go discovers this driver unit directly. It loads one owned temporary project in process and closes it; no consumer, executable or native host is built.
func TestCompilerObservationsReportEveryPredicate(t *testing.T) {
  if observations, complete := (*Program)(nil).CompilerObservations(); observations != nil || complete {
    t.Fatalf("nil program observations = %v, %v", observations, complete)
  }
  root := t.TempDir()
  source := "import { helper } from \"./helper\";\nexport const value: number = helper;\n"
  helper := "export const helper = 1;\n"
  if err := os.MkdirAll(filepath.Join(root, "src"), 0o700); err != nil {
    t.Fatal(err)
  }
  for name, text := range map[string]string{
    "tsconfig.json":  `{"compilerOptions":{"target":"es2022","module":"commonjs","strict":true,"types":[],"outDir":"dist"},"include":["src"]}`,
    "src/main.ts":    source,
    "src/helper.tsx": helper,
  } {
    if err := os.WriteFile(filepath.Join(root, filepath.FromSlash(name)), []byte(text), 0o600); err != nil {
      t.Fatal(err)
    }
  }
  prog, diagnostics, err := LoadProgram(root, "tsconfig.json", LoadProgramOptions{ForceEmit: true})
  if err != nil || len(diagnostics) != 0 {
    t.Fatalf("load: %v %v", err, diagnostics)
  }
  defer prog.Close()
  if _, _, err := prog.EmitAll(NewRewriteSet(), nil); err != nil {
    t.Fatal(err)
  }
  observations, complete := prog.CompilerObservations()
  if !complete {
    t.Fatal("a stable program reported an incomplete observation population")
  }
  find := func(path string) TransformInputObservation {
    t.Helper()
    for observed, observation := range observations {
      if sameObservedFile(t, observed, path) {
        return observation
      }
    }
    t.Fatalf("no observation for %s among %d paths", path, len(observations))
    return TransformInputObservation{}
  }
  digest := sha256.Sum256([]byte(source))
  main := find(filepath.Join(root, "src", "main.ts"))
  if main.ReadFile == nil || !main.ReadFile.OK || main.ReadFile.Hash != hex.EncodeToString(digest[:]) {
    t.Fatalf("source read observation = %+v", main.ReadFile)
  }
  directory := find(filepath.Join(root, "src"))
  if directory.AccessibleEntries == nil || !slices.Equal(directory.AccessibleEntries.Files, []string{"helper.tsx", "main.ts"}) {
    t.Fatalf("pattern directory observation = %+v", directory.AccessibleEntries)
  }
  // `./helper` resolves to helper.tsx only because helper.ts is absent.
  candidate := find(filepath.Join(root, "src", "helper.ts"))
  if candidate.FileExists == nil || *candidate.FileExists {
    t.Fatalf("missing candidate observation = %+v", candidate)
  }
}

// sameObservedFile compares a reported native spelling with an authored path
// through the filesystem, since a temporary root can be reported under another
// spelling of the same directory.
func sameObservedFile(t *testing.T, observed, authored string) bool {
  t.Helper()
  if filepath.Clean(observed) == filepath.Clean(authored) {
    return true
  }
  if filepath.Base(observed) != filepath.Base(authored) {
    return false
  }
  left, leftErr := filepath.EvalSymlinks(filepath.Dir(observed))
  right, rightErr := filepath.EvalSymlinks(filepath.Dir(authored))
  return leftErr == nil && rightErr == nil && left == right
}
