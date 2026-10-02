package strip_test

import (
  "os"
  "path/filepath"
  "testing"

  shared "github.com/samchon/ttsc/packages/strip/test/internal/shared"
)

// TestConfigReportsEveryObservedInputAndRejectedCandidate verifies that the
// strip driver declares the config it evaluated and every discovery candidate
// it rejected, each in the state it was found in.
//
// A persistent consumer keeps serving output built from the config it saw, so
// it must hear about the files that could supersede that config: a candidate
// created nearer the entry wins the next search, and a directory wearing a
// candidate name is a different observation from an absent one.
//
// 1. Place strip.config.json at the project root and a directory named
//    strip.config.ts beside the tsconfig two levels below.
// 2. Load from the nested tsconfig with recording reporters.
// 3. Assert one evaluated input with its content digest and physical path, the
//    directory candidate with the directory digest and its physical path, and
//    the nineteen absent candidates with nil hash and nil realpath.
//
// @evidence contracts/testing.md#behavioral-verification Calls the real loader with recording reporters and asserts the single reported input, its hash and realpath, the directory candidate's hash and realpath, the nineteen nil-hash nil-realpath absent candidates and that the incomplete reporter never fires for a JSON config.
// @evidence contracts/testing.md#independent-expectations The expected digests are SHA-256 values of the literal config bytes and of the literal "ttsc:host-input:directory" marker followed by a NUL byte, computed outside the implementation; physical paths come from filepath.EvalSymlinks and the candidate list from the seven documented filenames across the three searched directories.
// @evidence contracts/testing.md#distinguishing-cases Separates the evaluated file, a directory occupying a candidate name and absent candidates, and fixes the search extent: the nested directory, its parent and the project root, and nothing above the match.
// @evidence contracts/testing.md#execution-ownership Unit entry TestConfigReportsEveryObservedInputAndRejectedCandidate is discovered in test/unit by `go test ./packages/strip/...`, the root `test:go` command. It runs the loader, shared discovery and JSON parsing in the Go process; no Node child, compiler or Program is involved.
func TestConfigReportsEveryObservedInputAndRejectedCandidate(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root := shared.StripRealpathIfPossible(t.TempDir())
  nested := filepath.Join(root, "nested", "src")
  configPath := filepath.Join(root, "strip.config.json")
  shared.WriteFile(t, configPath, `{"calls":["trace"],"statements":["debugger"]}`)
  shared.WriteFile(t, filepath.Join(nested, "tsconfig.json"), `{}`)
  directoryCandidate := filepath.Join(nested, "strip.config.ts")
  if err := os.MkdirAll(directoryCandidate, 0o755); err != nil {
    t.Fatal(err)
  }

  inputs := []string{}
  hashes := map[string]*string{}
  realpaths := map[string]*string{}
  incomplete := 0
  config, err := stripLoadStripConfigMapWithReporters(
    map[string]any{"transform": "@ttsc/strip"},
    nested,
    filepath.Join(nested, "tsconfig.json"),
    func(input string) { inputs = append(inputs, input) },
    func(input string, hash *string) { hashes[input] = hash },
    func(input string, realpath *string) { realpaths[input] = realpath },
    func() { incomplete++ },
  )
  if err != nil {
    t.Fatal(err)
  }
  if calls, ok := config["calls"].([]any); !ok || len(calls) != 1 || calls[0] != "trace" {
    t.Fatalf("unexpected config: %#v", config)
  }
  if len(inputs) != 1 || inputs[0] != configPath {
    t.Fatalf("reported inputs = %v, want only %s", inputs, configPath)
  }
  if incomplete != 0 {
    t.Fatalf("a JSON config reported incomplete observation %d times", incomplete)
  }

  const configDigest = "b4ad15e1bac5c546db49a68613254a7d406999f0018b6fb2388089e031d7e673"
  const directoryDigest = "fd0fa85627c31fbf7205edf2a65a517a63bc9e66d7907804e0c613cf5b691cb1"
  if hash := hashes[configPath]; hash == nil || *hash != configDigest {
    t.Fatalf("config hash = %v, want %s", hash, configDigest)
  }
  wantReal := func(path string) string {
    real, err := filepath.EvalSymlinks(path)
    if err != nil {
      t.Fatal(err)
    }
    return filepath.Clean(real)
  }
  if real := realpaths[configPath]; real == nil || filepath.Clean(*real) != wantReal(configPath) {
    t.Fatalf("config realpath = %v, want %s", real, wantReal(configPath))
  }
  if hash := hashes[directoryCandidate]; hash == nil || *hash != directoryDigest {
    t.Fatalf("directory candidate hash = %v, want %s", hash, directoryDigest)
  }
  if real := realpaths[directoryCandidate]; real == nil || filepath.Clean(*real) != wantReal(directoryCandidate) {
    t.Fatalf("directory candidate realpath = %v, want %s", real, wantReal(directoryCandidate))
  }

  absent := 0
  for _, directory := range []string{nested, filepath.Join(root, "nested"), root} {
    for _, name := range []string{"strip.config.ts", "strip.config.mts", "strip.config.cts", "strip.config.js", "strip.config.mjs", "strip.config.cjs", "strip.config.json"} {
      candidate := filepath.Join(directory, name)
      if candidate == configPath || candidate == directoryCandidate {
        continue
      }
      hash, hashed := hashes[candidate]
      real, reported := realpaths[candidate]
      if !hashed || !reported || hash != nil || real != nil {
        t.Fatalf("absent candidate %s: hash=%v (reported %v), realpath=%v (reported %v), want observed-missing nil pair", candidate, hash, hashed, real, reported)
      }
      absent++
    }
  }
  if absent != 19 {
    t.Fatalf("checked %d absent candidates, want 19", absent)
  }
  if len(hashes) != 21 {
    t.Fatalf("hash reports = %d, want 21 (config, directory candidate, 19 absent)", len(hashes))
  }
}
