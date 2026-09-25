package lspserver

import (
  "encoding/json"
  "net/url"
  "os"
  "path/filepath"
  "runtime"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver/windowsjunction"
)

// TestNativePluginSourceEndsTheSessionOnASelectionInput verifies the inputs a
// session's plugin selection was loaded from end the session when they change,
// whatever plugins the session runs.
//
// The launcher hands the native host the files the descriptors' load read or
// probed and each plugin's Go sources, both by directory with the digest of
// every file, and the build's rule for residue and passed-over directories
// (samchon/ttsc#1507). They join the session's project inputs for its whole
// life, so the proxy's reload path, its watcher registration, and its
// registration-time recheck all cover them.
//
//  1. Hand a source with no plugin the selection inputs of a plugin module, whose
//     node_modules is a link, a descriptor, and two resolution candidates the
//     load probed and found missing, one in a directory that does not exist,
//     and assert they are current and each directory gets a children watcher.
//  2. Assert an unchanged source file, an editor backup, a directory the build
//     passes over, and an unrelated file do not match the reload path, while an
//     edit to a source file, a new source file, a new source directory, a
//     probed candidate appearing, a tree appearing with a probed candidate in
//     it, and an edit to the descriptor each do.
//  3. Hand it inputs whose source digest no longer matches, and assert the source
//     refuses to start.
func TestNativePluginSourceEndsTheSessionOnASelectionInput(t *testing.T) {
  root := t.TempDir()
  module := filepath.Join(root, "plugin")
  rules := filepath.Join(module, "rules")
  rule := filepath.Join(rules, "rule.go")
  other := filepath.Join(rules, "other.go")
  descriptor := filepath.Join(root, "descriptor.js")
  unrelated := filepath.Join(root, "notes.md")
  candidate := filepath.Join(root, "descriptor.cjs")
  tree := filepath.Join(root, "node_modules")
  nested := filepath.Join(tree, "pkg", "package.json")
  write := func(file, text string) {
    t.Helper()
    if err := os.MkdirAll(filepath.Dir(file), 0o755); err != nil {
      t.Fatal(err)
    }
    if err := os.WriteFile(file, []byte(text), 0o644); err != nil {
      t.Fatal(err)
    }
  }
  mkdir := func(directory string) {
    t.Helper()
    if err := os.MkdirAll(directory, 0o755); err != nil {
      t.Fatal(err)
    }
  }
  write(rule, "package rules\n")
  write(other, "package rules\n")
  write(filepath.Join(module, "go.mod"), "module example.com/plugin\n")
  write(descriptor, "module.exports = {};\n")
  write(unrelated, "notes\n")
  // A package's dependencies linked into the module, as pnpm links them: a
  // link the build passes over by name, which the host must pass over too.
  shared := filepath.Join(root, "shared-modules")
  write(filepath.Join(shared, "dep", "index.js"), "\n")
  link := filepath.Join(module, "node_modules")
  if runtime.GOOS == "windows" {
    if err := windowsjunction.Create(link, shared); err != nil {
      t.Fatal(err)
    }
  } else if err := os.Symlink(shared, link); err != nil {
    t.Fatal(err)
  }
  missing := projectInputReloadFileDigest(candidate)
  inputs := func() NativePluginSelectionInputs {
    return NativePluginSelectionInputs{
      DescriptorFiles: map[string]map[string]string{
        root: {
          "descriptor.cjs": missing,
          "descriptor.js":  projectInputReloadFileDigest(descriptor),
        },
        filepath.Dir(nested): {"package.json": missing},
      },
      SourceFiles: map[string]map[string]string{
        module: {
          "go.mod": projectInputReloadFileDigest(filepath.Join(module, "go.mod")),
        },
        rules: {
          "other.go": projectInputReloadFileDigest(other),
          "rule.go":  projectInputReloadFileDigest(rule),
        },
      },
      OmittedNames:         []string{"go.work"},
      OmittedSuffixes:      []string{"~"},
      PrunedDirectoryNames: []string{"node_modules"},
    }
  }
  manifest := func(selection NativePluginSelectionInputs) string {
    t.Helper()
    body, err := json.Marshal(NativePluginManifest{SelectionInputs: &selection})
    if err != nil {
      t.Fatal(err)
    }
    return string(body)
  }
  uri := func(file string) string {
    return (&url.URL{
      Scheme: "file",
      Path:   "/" + strings.TrimPrefix(filepath.ToSlash(file), "/"),
    }).String()
  }

  // 1. Watched, although no plugin declares project inputs.
  source, err := NewNativePluginSource(NativePluginSourceOptions{
    Cwd:          root,
    ManifestJSON: manifest(inputs()),
  })
  if err != nil {
    t.Fatalf("new source: %v", err)
  }
  merged := source.ProjectInputs()
  if len(merged.WatchDirectories) != 4 {
    t.Fatalf("selection inputs are not watched: %#v", merged)
  }
  watchers := map[string]bool{}
  for _, watcher := range projectInputFileWatchers(merged) {
    watchers[watcher.GlobPattern.BaseURI+" "+watcher.GlobPattern.Pattern] = true
  }
  for _, want := range []string{
    projectInputFileURI(realProjectInputPath(rules)) + " *",
    projectInputFileURI(realProjectInputPath(root)) + " *",
    projectInputFileURI(realProjectInputPath(root)) + " node_modules/pkg/*",
  } {
    if !watchers[want] {
      t.Fatalf("no children watcher %q among %v", want, watchers)
    }
  }
  if !source.ProjectInputReloadFingerprintsAreCurrent() {
    t.Fatal("an unchanged selection is not current")
  }

  // 2. What ends the session, and what does not.
  changed := 2
  created := 1
  matches := func(location string, change *int) bool {
    return source.ProjectInputReloadMatchesChange(uri(location), change)
  }
  if matches(other, &changed) {
    t.Fatal("an unchanged plugin source file ended the session")
  }
  backup := filepath.Join(rules, "rule.go~")
  write(backup, "package rules\n")
  if matches(backup, &created) {
    t.Fatal("an editor backup the build never keys on ended the session")
  }
  if matches(link, &created) {
    t.Fatal("a directory the build passes over ended the session")
  }
  write(unrelated, "notes, edited\n")
  if matches(unrelated, &changed) {
    t.Fatal("an unrelated file ended the session")
  }
  if !source.ProjectInputReloadFingerprintsAreCurrent() {
    t.Fatal("changes the selection never read made it stale")
  }
  write(rule, "package rules\n\n// edited\n")
  if !matches(rule, &changed) {
    t.Fatal("an edit to a plugin source file did not end the session")
  }
  write(rule, "package rules\n")
  added := filepath.Join(rules, "added.go")
  write(added, "package rules\n")
  if !matches(added, &created) {
    t.Fatal("a new plugin source file did not end the session")
  }
  if err := os.Remove(added); err != nil {
    t.Fatal(err)
  }
  subpackage := filepath.Join(module, "extra")
  mkdir(subpackage)
  if !matches(subpackage, &created) {
    t.Fatal("a new source directory did not end the session")
  }
  if err := os.Remove(subpackage); err != nil {
    t.Fatal(err)
  }
  write(candidate, "module.exports = {};\n")
  if !matches(candidate, &created) {
    t.Fatal("a probed resolution candidate appearing did not end the session")
  }
  if err := os.Remove(candidate); err != nil {
    t.Fatal(err)
  }
  // A client may report a tree appearing as the one change of its root.
  write(nested, "{}\n")
  if !matches(tree, &created) {
    t.Fatal("a tree holding a probed candidate did not end the session")
  }
  if err := os.RemoveAll(tree); err != nil {
    t.Fatal(err)
  }
  if !source.ProjectInputReloadFingerprintsAreCurrent() {
    t.Fatal("a selection restored to what it was loaded from is not current")
  }
  write(descriptor, "module.exports = { edited: true };\n")
  if !matches(descriptor, &changed) {
    t.Fatal("an edit to the descriptor did not end the session")
  }
  if source.ProjectInputReloadFingerprintsAreCurrent() {
    t.Fatal("an edited selection is still current")
  }

  // 3. A source digest the filesystem no longer matches refuses the start.
  stale := inputs()
  stale.SourceFiles[rules]["rule.go"] = strings.Repeat("0", 64)
  if _, err := NewNativePluginSource(NativePluginSourceOptions{
    Cwd:          root,
    ManifestJSON: manifest(stale),
  }); err == nil || !strings.Contains(err.Error(), "changed during startup") {
    t.Fatalf("a stale source fingerprint started a session: %v", err)
  }
}
