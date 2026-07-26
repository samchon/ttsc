//go:build windows

package lspserver

import (
  "os"
  "os/exec"
  "path/filepath"
  "reflect"
  "slices"
  "testing"
)

// TestProjectInputPathKeyRespectsDirectoryCaseSemantics verifies the Go host
// keeps case-distinct Windows dependencies without splitting ordinary aliases.
//
//  1. Enable case sensitivity on a disposable directory and create two real
//     dependencies whose paths differ only by case.
//  2. Prove merged publication and owner matching retain both identities.
//  3. Prove glob matching and reload containment obey each owning directory.
//  4. Prove missing suffixes also retain case under an opted-in directory.
//  5. On an ordinary directory, prove existing and missing aliases converge.
//  6. Change a live directory's flag and normalize UNC volume aliases.
func TestProjectInputPathKeyRespectsDirectoryCaseSemantics(t *testing.T) {
  sensitiveRoot := t.TempDir()
  enableProjectInputCaseSensitivity(t, sensitiveRoot)

  firstDirectory := filepath.Join(sensitiveRoot, "Project")
  secondDirectory := filepath.Join(sensitiveRoot, "project")
  if err := os.Mkdir(firstDirectory, 0o755); err != nil {
    t.Fatal(err)
  }
  if err := os.Mkdir(secondDirectory, 0o755); err != nil {
    t.Fatal(err)
  }
  enableProjectInputCaseSensitivity(t, firstDirectory)
  enableProjectInputCaseSensitivity(t, secondDirectory)

  firstInput := filepath.Join(firstDirectory, "Spec.md")
  secondInput := filepath.Join(secondDirectory, "Spec.md")
  if err := os.WriteFile(firstInput, []byte("first\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(secondInput, []byte("second\n"), 0o644); err != nil {
    t.Fatal(err)
  }

  first := NativeLSPPluginEntry{
    Binary:        "ttsc-case-sensitive-first",
    Name:          "@ttsc/case-sensitive-first",
    ProjectInputs: true,
  }
  second := NativeLSPPluginEntry{
    Binary:        "ttsc-case-sensitive-second",
    Name:          "@ttsc/case-sensitive-second",
    ProjectInputs: true,
  }
  source := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first, second},
  }
  source.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(sensitiveRoot),
    Files: []string{filepath.ToSlash(firstInput)},
  })
  source.storeProjectInputs(second, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(sensitiveRoot),
    Files: []string{filepath.ToSlash(secondInput)},
  })

  merged := source.ProjectInputs()
  if !reflect.DeepEqual(
    merged.Files,
    []string{filepath.ToSlash(firstInput), filepath.ToSlash(secondInput)},
  ) {
    t.Fatalf("case-sensitive merged files = %#v", merged.Files)
  }
  assertProjectInputOwners(t, source, firstInput, []string{pluginKey(first)})
  assertProjectInputOwners(t, source, secondInput, []string{pluginKey(second)})
  if projectInputPathContains(firstDirectory, secondInput) {
    t.Fatal("case-sensitive sibling was classified as a descendant")
  }
  reloadSource := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first},
  }
  reloadSource.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root:              filepath.ToSlash(sensitiveRoot),
    ReloadDirectories: []string{filepath.ToSlash(firstDirectory)},
  })
  if reloadSource.ProjectInputReloadMatchesURI(testFileURI(secondInput)) {
    t.Fatal("case-sensitive sibling was classified as an immediate reload entry")
  }

  upperJSON := filepath.Join(firstDirectory, "Upper.JSON")
  lowerJSON := filepath.Join(firstDirectory, "lower.json")
  if err := os.WriteFile(upperJSON, []byte("{}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if err := os.WriteFile(lowerJSON, []byte("{}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  sensitiveGlobSource := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first},
  }
  sensitiveGlobSource.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(sensitiveRoot),
    Globs: []string{filepath.ToSlash(filepath.Join(firstDirectory, "*.json"))},
  })
  assertProjectInputOwners(
    t,
    sensitiveGlobSource,
    lowerJSON,
    []string{pluginKey(first)},
  )
  assertProjectInputOwners(t, sensitiveGlobSource, upperJSON, nil)

  insensitiveChild := filepath.Join(sensitiveRoot, "Insensitive")
  if err := os.Mkdir(insensitiveChild, 0o755); err != nil {
    t.Fatal(err)
  }
  disableProjectInputCaseSensitivity(t, insensitiveChild)
  mixedJSON := filepath.Join(insensitiveChild, "Schema.JSON")
  if err := os.WriteFile(mixedJSON, []byte("{}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  mixedGlobSource := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first},
  }
  mixedGlobSource.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root: filepath.ToSlash(sensitiveRoot),
    Globs: []string{
      filepath.ToSlash(filepath.Join(insensitiveChild, "*.json")),
    },
  })
  assertProjectInputOwners(
    t,
    mixedGlobSource,
    mixedJSON,
    []string{pluginKey(first)},
  )

  firstMissing := filepath.Join(firstDirectory, "Missing.json")
  secondMissing := filepath.Join(firstDirectory, "missing.json")
  if projectInputPathKey(firstMissing) == projectInputPathKey(secondMissing) {
    t.Fatal("case-sensitive missing suffixes collapsed")
  }

  ordinaryRoot := t.TempDir()
  if queryProjectInputDirectoryCaseSensitivity(ordinaryRoot) {
    t.Skip("ordinary-volume negative twin requires a case-insensitive temp root")
  }
  ordinaryInput := filepath.Join(ordinaryRoot, "Alias.md")
  ordinaryAlias := filepath.Join(ordinaryRoot, "aLIAS.MD")
  if err := os.WriteFile(ordinaryInput, []byte("ordinary\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  if _, err := os.Stat(ordinaryAlias); err != nil {
    t.Skipf("temp volume does not resolve case aliases: %v", err)
  }
  if projectInputPathKey(ordinaryInput) != projectInputPathKey(ordinaryAlias) {
    t.Fatal("ordinary existing aliases split")
  }
  if projectInputPathKey(filepath.Join(ordinaryRoot, "Missing.json")) !=
    projectInputPathKey(filepath.Join(ordinaryRoot, "missing.json")) {
    t.Fatal("ordinary missing aliases split")
  }
  upperJSON = filepath.Join(ordinaryRoot, "Schema.JSON")
  if err := os.WriteFile(upperJSON, []byte("{}\n"), 0o644); err != nil {
    t.Fatal(err)
  }
  ordinaryGlobSource := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first},
  }
  ordinaryGlobSource.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(ordinaryRoot),
    Globs: []string{filepath.ToSlash(filepath.Join(ordinaryRoot, "*.json"))},
  })
  assertProjectInputOwners(
    t,
    ordinaryGlobSource,
    upperJSON,
    []string{pluginKey(first)},
  )

  ordinarySource := &NativePluginSource{
    plugins: []NativeLSPPluginEntry{first, second},
  }
  ordinarySource.storeProjectInputs(first, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(ordinaryRoot),
    Files: []string{filepath.ToSlash(ordinaryInput)},
  })
  ordinarySource.storeProjectInputs(second, 1, LSPProjectInputSnapshot{
    Root:  filepath.ToSlash(ordinaryRoot),
    Files: []string{filepath.ToSlash(ordinaryAlias)},
  })
  if got := ordinarySource.ProjectInputs().Files; len(got) != 1 {
    t.Fatalf("ordinary aliases produced %d merged files: %#v", len(got), got)
  }

  mutableRoot := t.TempDir()
  firstMissing = filepath.Join(mutableRoot, "Missing.json")
  secondMissing = filepath.Join(mutableRoot, "missing.json")
  if projectInputPathKey(firstMissing) != projectInputPathKey(secondMissing) {
    t.Fatal("ordinary mutable directory began case-sensitive")
  }
  enableProjectInputCaseSensitivity(t, mutableRoot)
  if projectInputPathKey(firstMissing) == projectInputPathKey(secondMissing) {
    t.Fatal("case-sensitivity change was hidden by stale identity state")
  }

  upperUNC := windowsProjectInputKey(
    `\\SERVER\Share\Folder\File.json`,
    []string{"folder", "file.json"},
  )
  lowerUNC := windowsProjectInputKey(
    `\\server\share\Folder\File.json`,
    []string{"folder", "file.json"},
  )
  if upperUNC != lowerUNC || upperUNC != "//server/share/folder/file.json" {
    t.Fatalf("UNC volume aliases = %q and %q", upperUNC, lowerUNC)
  }
}

func enableProjectInputCaseSensitivity(t *testing.T, directory string) {
  t.Helper()
  command := exec.Command(
    "fsutil.exe",
    "file",
    "setCaseSensitiveInfo",
    directory,
    "enable",
  )
  if output, err := command.CombinedOutput(); err != nil {
    t.Skipf(
      "per-directory case sensitivity is unavailable: %v\n%s",
      err,
      output,
    )
  }
}

func disableProjectInputCaseSensitivity(t *testing.T, directory string) {
  t.Helper()
  command := exec.Command(
    "fsutil.exe",
    "file",
    "setCaseSensitiveInfo",
    directory,
    "disable",
  )
  if output, err := command.CombinedOutput(); err != nil {
    t.Fatalf("failed to disable per-directory case sensitivity: %v\n%s", err, output)
  }
}

func assertProjectInputOwners(
  t *testing.T,
  source *NativePluginSource,
  input string,
  want []string,
) {
  t.Helper()
  if got := source.ProjectInputOwnersForURI(testFileURI(input)); !slices.Equal(
    got,
    want,
  ) {
    t.Fatalf("%s owners = %#v, want %#v", input, got, want)
  }
}
