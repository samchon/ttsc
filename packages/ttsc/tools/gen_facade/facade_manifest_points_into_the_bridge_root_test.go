package main

import (
  "os"
  "path/filepath"
  "strings"
  "testing"

  "golang.org/x/mod/modfile"
)

// Verifies a facade manifest requires and replaces exactly the bridges its
// facade imports, each replacement relative from the facade into the bridge root.
//
// Facades and bridges live in sibling roots of one compiler target. A replace
// path computed from the facade's own depth alone would point outside the
// bridge root for a nested facade such as vfs/cachedvfs.
//
//  1. Write a nested facade go.mod that still requires and replaces a bridge it
//     no longer imports, beside an unrelated requirement.
//  2. Build its manifest for the two bridges it now imports.
//  3. Parse the result and compare its requirements and replacements.
//
// @evidence contracts/testing.md#behavioral-verification Calls the production facadeManifest over a real go.mod file and parses its output with x/mod, asserting module, requirements and replacement targets.
// @evidence contracts/testing.md#independent-expectations The expected replacement paths follow from the authored sibling layout, three levels up from targets/7.1/facade/vfs/cachedvfs and into bridge/, not from the generator's output.
// @evidence contracts/testing.md#distinguishing-cases A stale bridge requirement and replacement must be dropped, two imported bridges at different depths must be added, and an unrelated requirement must survive.
// @evidence contracts/testing.md#execution-ownership This tools/gen_facade unit writes one temporary go.mod and reads it in process; it loads no package and starts no process.
func TestFacadeManifestPointsIntoTheBridgeRoot(t *testing.T) {
  target := t.TempDir()
  bridgeRoot := filepath.Join(target, "bridge")
  facadeDir := filepath.Join(target, "facade", "vfs", "cachedvfs")
  if err := os.MkdirAll(facadeDir, 0o755); err != nil {
    t.Fatal(err)
  }
  manifestPath := filepath.Join(facadeDir, "go.mod")
  stale := bridgePrefix + "tspath"
  if err := os.WriteFile(manifestPath, []byte("module "+facadePrefix+"vfs/cachedvfs\n\ngo 1.27\n\nrequire (\n\t"+stale+" v0.0.0\n\texample.com/kept v1.2.3\n)\n\nreplace "+stale+" => ../../../bridge/tspath\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  source, err := facadeManifest(manifestPath, "vfs/cachedvfs", bridgeRoot, []string{bridgePrefix + "vfs/cachedvfs", bridgePrefix + "vfs"})
  if err != nil {
    t.Fatal(err)
  }
  file, err := modfile.Parse(manifestPath, source, nil)
  if err != nil {
    t.Fatal(err)
  }
  requires := map[string]string{}
  for _, require := range file.Require {
    requires[require.Mod.Path] = require.Mod.Version
  }
  replaces := map[string]string{}
  for _, replace := range file.Replace {
    replaces[replace.Old.Path] = replace.New.Path
  }
  want := map[string]string{
    bridgePrefix + "vfs/cachedvfs": "../../../bridge/vfs/cachedvfs",
    bridgePrefix + "vfs":           "../../../bridge/vfs",
  }
  for bridge, path := range want {
    if requires[bridge] != "v0.0.0" || replaces[bridge] != path {
      t.Errorf("%s: require %q, replace %q; want v0.0.0 and %q", bridge, requires[bridge], replaces[bridge], path)
    }
  }
  if _, ok := requires[stale]; ok {
    t.Errorf("stale bridge requirement survived:\n%s", source)
  }
  if _, ok := replaces[stale]; ok || len(replaces) != len(want) {
    t.Errorf("replacements = %v, want only %v", replaces, want)
  }
  if requires["example.com/kept"] != "v1.2.3" || !strings.HasPrefix(string(source), "module "+facadePrefix+"vfs/cachedvfs") {
    t.Errorf("unrelated lines changed:\n%s", source)
  }
}
