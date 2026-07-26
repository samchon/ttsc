//go:build windows

package lspserver

import (
  "os"
  "os/exec"
  "path/filepath"
  "reflect"
  "testing"
)

// TestProjectInputPathKeyRespectsDirectoryCaseSemantics verifies the Go host
// keeps case-distinct Windows dependencies without splitting ordinary aliases.
//
//  1. Enable case sensitivity on a disposable directory and create two real
//     dependencies whose paths differ only by case.
//  2. Prove merged publication and owner matching retain both identities.
//  3. Prove missing suffixes also retain case under an opted-in directory.
//  4. On an ordinary directory, prove existing and missing aliases converge.
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

func assertProjectInputOwners(
  t *testing.T,
  source *NativePluginSource,
  input string,
  want []string,
) {
  t.Helper()
  if got := source.ProjectInputOwnersForURI(testFileURI(input)); !reflect.DeepEqual(
    got,
    want,
  ) {
    t.Fatalf("%s owners = %#v, want %#v", input, got, want)
  }
}
