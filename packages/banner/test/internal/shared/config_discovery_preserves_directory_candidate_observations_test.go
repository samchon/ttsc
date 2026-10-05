package shared

import (
  "crypto/sha256"
  "fmt"
  "os"
  "path/filepath"
  "reflect"
  "testing"
)

// TestConfigDiscoveryPreservesDirectoryCandidateObservations verifies native
// banner lookup preserves candidate proofs and selects appearing/replaced configs.
//
// A nearer directory named banner.config.json is not a config file. Its kind
// digest and physical path must still be reported while the outer JSON config
// supplies the banner. Replacing that directory by a JSON file changes both
// selection and observations. This owns the native facts used by the transform
// cache case, without constructing a cache generation or a host envelope.
// A separate, initially missing consumer candidate appears as a regular file
// before the directory transition; these are different filesystem states.
//
// 1. Place OUTER BANNER above a nearer config-shaped directory and consumer.
// 2. Resolve twice and assert outer text, directory proofs and missing proofs.
// 3. Create the same formerly missing consumer config and assert its selection,
//    content/physical proofs and withdrawal of ancestor observations; repeat.
// 4. Remove that consumer config, replace the directory with NEARER BANNER and
//    assert new text/file proofs and unchanged replacement observations.
//
// @evidence contracts/testing.md#behavioral-verification Calls the actual native resolveBannerTextWithReporters through the existing shared test bridge. OUTER BANNER survives a nearer directory candidate with its kind/physical proofs. The same initially missing consumer path appearing as a regular JSON config selects NEARER BANNER with exact content/physical proofs and withdraws ancestor observations. After removing that consumer config, replacing the directory also selects NEARER BANNER with file proofs. Unchanged repetitions preserve each state's observations.
// @evidence contracts/testing.md#independent-expectations Authored OUTER BANNER and NEARER BANNER literals define selection. SHA-256 over the documented ttsc:host-input:directory NUL marker and literal replacement bytes defines hashes independently; filepath.EvalSymlinks observes physical identity. No expected observation comes from the prior product result, except the separate unchanged-state equality assertions.
// @evidence contracts/testing.md#distinguishing-cases The same nearer missing path reports nil proofs before appearing as a selected file; this is distinct from the retained directory-to-file transition. Ancestor observations disappear once the nearer file wins. Repeated unchanged-directory and unchanged-file calls contrast with mutations. Hash/realpath callback keys identify rejected candidates; the selected-input callback only reports the loaded config, so no synthetic hostInputs envelope is asserted.
// @evidence contracts/testing.md#execution-ownership The discoverable Go Test entry lives under test/internal/shared and uses its already existing native bridge in the test process. JSON parsing, native discovery and proof callbacks need no installation, native producer, Program, watcher, IPC or child. t.TempDir owns fixture cleanup and t.Setenv restores the discovery anchor. Transform-cache generation identity and native envelope assembly retain separate owners.
func TestConfigDiscoveryPreservesDirectoryCandidateObservations(t *testing.T) {
  t.Setenv("TTSC_PLUGIN_CONFIG_DIR", "")
  root, err := filepath.EvalSymlinks(t.TempDir())
  if err != nil {
    t.Fatal(err)
  }
  middle := filepath.Join(root, "middle")
  consumer := filepath.Join(middle, "consumer")
  directory := filepath.Join(middle, "banner.config.json")
  if err := os.MkdirAll(consumer, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Mkdir(directory, 0o755); err != nil {
    t.Fatal(err)
  }
  outer := filepath.Join(root, "banner.config.json")
  WriteFile(t, outer, `{"text":"OUTER BANNER"}`)
  missing := filepath.Join(consumer, "banner.config.json")
  type observation struct {
    text      string
    inputs    []string
    hashes    map[string]*string
    realpaths map[string]*string
  }
  resolve := func() observation {
    t.Helper()
    got := observation{hashes: map[string]*string{}, realpaths: map[string]*string{}}
    capture := func(target map[string]*string) func(string, *string) {
      return func(file string, value *string) {
        if value == nil {
          target[file] = nil
          return
        }
        copied := *value
        target[file] = &copied
      }
    }
    text, err := bannerResolveBannerTextWithReporters(
      map[string]any{}, consumer, filepath.Join(consumer, "tsconfig.json"),
      func(file string) { got.inputs = append(got.inputs, file) },
      capture(got.hashes), capture(got.realpaths),
    )
    if err != nil {
      t.Fatal(err)
    }
    got.text = text
    return got
  }
  requireProof := func(values map[string]*string, file, expected string) {
    t.Helper()
    value, exists := values[file]
    if !exists || value == nil || *value != expected {
      t.Fatalf("proof for %s = %v (present=%v), want %q", file, value, exists, expected)
    }
  }
  first := resolve()
  if first.text != "OUTER BANNER" || !reflect.DeepEqual(first.inputs, []string{outer}) {
    t.Fatalf("directory selection = %q, inputs=%v", first.text, first.inputs)
  }
  directoryDigest := fmt.Sprintf("%x", sha256.Sum256([]byte("ttsc:host-input:directory\x00")))
  physical, err := filepath.EvalSymlinks(directory)
  if err != nil {
    t.Fatal(err)
  }
  requireProof(first.hashes, directory, directoryDigest)
  requireProof(first.realpaths, directory, filepath.Clean(physical))
  for _, values := range []map[string]*string{first.hashes, first.realpaths} {
    value, exists := values[missing]
    if !exists || value != nil {
      t.Fatalf("missing candidate proof = %v (present=%v), want observed nil", value, exists)
    }
  }
  if repeated := resolve(); !reflect.DeepEqual(repeated, first) {
    t.Fatalf("unchanged directory observations differ: %#v != %#v", repeated, first)
  }
  replacement := `{"text":"NEARER BANNER"}`
  WriteFile(t, missing, replacement)
  appeared := resolve()
  if appeared.text != "NEARER BANNER" || !reflect.DeepEqual(appeared.inputs, []string{missing}) {
    t.Fatalf("appeared candidate selection = %q, inputs=%v", appeared.text, appeared.inputs)
  }
  requireProof(appeared.hashes, missing, fmt.Sprintf("%x", sha256.Sum256([]byte(replacement))))
  appearedPhysical, err := filepath.EvalSymlinks(missing)
  if err != nil {
    t.Fatal(err)
  }
  requireProof(appeared.realpaths, missing, filepath.Clean(appearedPhysical))
  for _, ancestor := range []string{outer, directory} {
    for _, values := range []map[string]*string{appeared.hashes, appeared.realpaths} {
      if _, exists := values[ancestor]; exists {
        t.Fatalf("superseded ancestor %s remained in appeared-file observations", ancestor)
      }
    }
  }
  if repeated := resolve(); !reflect.DeepEqual(repeated, appeared) {
    t.Fatalf("unchanged appeared-file observations differ: %#v != %#v", repeated, appeared)
  }
  if err := os.Remove(missing); err != nil {
    t.Fatal(err)
  }
  if err := os.Remove(directory); err != nil {
    t.Fatal(err)
  }
  WriteFile(t, directory, replacement)
  replaced := resolve()
  if replaced.text != "NEARER BANNER" || !reflect.DeepEqual(replaced.inputs, []string{directory}) {
    t.Fatalf("replacement selection = %q, inputs=%v", replaced.text, replaced.inputs)
  }
  requireProof(replaced.hashes, directory, fmt.Sprintf("%x", sha256.Sum256([]byte(replacement))))
  requireProof(replaced.realpaths, directory, filepath.Clean(physical))
  if _, exists := replaced.hashes[outer]; exists {
    t.Fatal("superseded outer config remained in discovery observations")
  }
  if repeated := resolve(); !reflect.DeepEqual(repeated, replaced) {
    t.Fatalf("unchanged replacement observations differ: %#v != %#v", repeated, replaced)
  }
}
