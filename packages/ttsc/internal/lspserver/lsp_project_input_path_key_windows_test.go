//go:build windows

package lspserver

import (
  "os"
  "os/exec"
  "path/filepath"
  "reflect"
  "slices"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/internal/e2etrace"
)

// TestProjectInputPathKeyRespectsDirectoryCaseSemantics verifies the Go host
// keeps case-distinct Windows dependencies without splitting ordinary aliases.
//
// A global case fold would merge distinct files below an opted-in
// case-sensitive directory, while preserving every spelling would split
// ordinary NTFS, UNC, and recreated-directory aliases. Identity must instead
// follow the case semantics of the directory that owns each path segment.
//
//  1. Enable case sensitivity on a disposable directory and create two real
//     dependencies whose paths differ only by case.
//  2. Compare stored-input aggregation and owner matching for both identities.
//  3. Compare glob matching and reload containment at the owning directories.
//  4. Compare missing suffixes under an opted-in directory.
//  5. On an ordinary directory, compare existing and missing aliases.
//  6. Change a live directory's flag and normalize UNC volume aliases.
//
// @evidence contracts/testing.md#behavioral-verification Direct stored input aggregation, owner selection, glob and reload predicates distinguish case-sensitive siblings and insensitive aliases. Missing-suffix keys react to a directory flag change and recreation. Literal UNC volume assembly and conditional native extended-UNC/junction cases exercise separate path identities; no client publication or actual plugin reload is observed.
// @evidence contracts/testing.md#independent-expectations Owned native files and observed directory semantics establish equality/inequality premises. Literal transport owner keys and the literal UNC key do not reuse the key helpers as expected values; shared normalization/digest helpers establish inputs and do not independently certify fingerprint correctness.
// @evidence contracts/testing.md#distinguishing-cases Existing and missing paths, sensitive siblings, an insensitive child, ordinary aliases, live flag changes, recreation, literal UNC volumes, conditional extended UNC, physical junction ownership, junction creation, deletion and retarget are distinct lanes. Setup-error and unavailable-share skips leave those native lanes unverified on that run.
// @evidence contracts/testing.md#execution-ownership This Windows-only discoverable Go unit directly calls owning native filesystem identity and stored-input policy operations. Owned fsutil and cmd mklink setup children use CombinedOutput once per invocation and private opt-in observation; setup failures retain existing skips without certifying their cause. No Go build, native plugin sidecar, installed consumer, editor or product host executes.
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
  assertProjectInputOwners(t, source, firstInput, []string{"ttsc-case-sensitive-first\x000"})
  assertProjectInputOwners(t, source, secondInput, []string{"ttsc-case-sensitive-second\x000"})
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
    []string{"ttsc-case-sensitive-first\x000"},
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
    []string{"ttsc-case-sensitive-first\x000"},
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
    []string{"ttsc-case-sensitive-first\x000"},
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

  mutableParent := t.TempDir()
  mutableRoot := filepath.Join(mutableParent, "mutable")
  if err := os.Mkdir(mutableRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  firstMissing = filepath.Join(mutableRoot, "Missing.json")
  secondMissing = filepath.Join(mutableRoot, "missing.json")
  if projectInputPathKey(firstMissing) != projectInputPathKey(secondMissing) {
    t.Fatal("ordinary mutable directory began case-sensitive")
  }
  enableProjectInputCaseSensitivity(t, mutableRoot)
  if projectInputPathKey(firstMissing) == projectInputPathKey(secondMissing) {
    t.Fatal("case-sensitivity change was hidden by stale identity state")
  }
  if err := os.Remove(mutableRoot); err != nil {
    t.Fatal(err)
  }
  if err := os.Mkdir(mutableRoot, 0o755); err != nil {
    t.Fatal(err)
  }
  if projectInputPathKey(firstMissing) != projectInputPathKey(secondMissing) {
    t.Fatal("recreated ordinary directory retained stale sensitivity")
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

  t.Run("extended UNC aliases", func(t *testing.T) {
    volume := filepath.VolumeName(ordinaryRoot)
    if len(volume) != 2 || volume[1] != ':' {
      t.Skipf("temporary directory has no drive volume: %q", volume)
    }
    tail := strings.TrimPrefix(ordinaryRoot, volume)
    unc := `\\localhost\` + strings.ToUpper(volume[:1]) + `$` + tail
    if _, err := os.Stat(unc); err != nil {
      t.Skipf("administrative UNC share is unavailable: %v", err)
    }
    extended := `\\?\UNC\` + strings.TrimPrefix(unc, `\\`)
    if projectInputPathKey(realProjectInputPath(unc)) !=
      projectInputPathKey(realProjectInputPath(extended)) {
      t.Fatalf("standard and extended UNC aliases split: %q, %q", unc, extended)
    }
  })

  t.Run("junction physical identity", func(t *testing.T) {
    declarationRoot := t.TempDir()
    physicalRoot := t.TempDir()
    for _, directory := range []string{
      filepath.Join(physicalRoot, "docs"),
      filepath.Join(physicalRoot, "api"),
    } {
      if err := os.MkdirAll(directory, 0o755); err != nil {
        t.Fatal(err)
      }
    }
    exact := filepath.Join(physicalRoot, "docs", "spec.md")
    globbed := filepath.Join(physicalRoot, "api", "schema.json")
    for _, location := range []string{exact, globbed} {
      if err := os.WriteFile(location, []byte("{}\n"), 0o644); err != nil {
        t.Fatal(err)
      }
    }
    junction := filepath.Join(declarationRoot, "alias")
    createProjectInputJunction(t, junction, physicalRoot)
    snapshot, err := normalizeLSPProjectInputSnapshot(
      LSPProjectInputSnapshot{
        Root: declarationRoot,
        Files: []string{
          filepath.Join(junction, "docs", "spec.md"),
        },
        Globs: []string{
          filepath.Join(junction, "api", "**", "*.json"),
        },
      },
      declarationRoot,
    )
    if err != nil {
      t.Fatalf("normalize junction inputs: %v", err)
    }
    junctionSource := &NativePluginSource{
      plugins: []NativeLSPPluginEntry{first},
    }
    junctionSource.storeProjectInputs(first, 1, snapshot)
    if !junctionSource.ProjectInputReloadFingerprintsAreCurrent() {
      t.Fatal("junction reload baseline began stale")
    }
    assertProjectInputOwners(
      t,
      junctionSource,
      exact,
      []string{"ttsc-case-sensitive-first\x000"},
    )
    assertProjectInputOwners(
      t,
      junctionSource,
      globbed,
      []string{"ttsc-case-sensitive-first\x000"},
    )
  })

  t.Run("external junction selects reload", func(t *testing.T) {
    reloadRoot := t.TempDir()
    externalRoot := t.TempDir()
    junction := filepath.Join(reloadRoot, "api")
    snapshot, err := normalizeLSPProjectInputSnapshot(
      LSPProjectInputSnapshot{
        Root:              reloadRoot,
        Globs:             []string{filepath.Join(junction, "**", "*.json")},
        ReloadDirectories: []string{reloadRoot},
      },
      reloadRoot,
    )
    if err != nil {
      t.Fatalf("normalize reload inputs: %v", err)
    }
    junctionSource := &NativePluginSource{
      plugins: []NativeLSPPluginEntry{first},
    }
    junctionSource.storeProjectInputs(first, 1, snapshot)
    createProjectInputJunction(t, junction, externalRoot)
    created := fileChangeTypeCreated
    if !junctionSource.ProjectInputReloadMatchesChange(
      testFileURI(junction),
      &created,
    ) {
      t.Fatal("external junction creation did not select plugin reload")
    }
  })

  t.Run("junction reload directory retains entry identity", func(t *testing.T) {
    parent := t.TempDir()
    firstTarget := t.TempDir()
    secondTarget := t.TempDir()
    junction := filepath.Join(parent, "selection")
    createProjectInputJunction(t, junction, firstTarget)
    snapshot, err := normalizeLSPProjectInputSnapshot(
      LSPProjectInputSnapshot{
        Root:              parent,
        ReloadDirectories: []string{junction},
      },
      parent,
    )
    if err != nil {
      t.Fatalf("normalize junction reload directory: %v", err)
    }
    if len(snapshot.ReloadDirectories) != 2 {
      t.Fatalf(
        "junction reload identities = %#v, want physical and entry spellings",
        snapshot.ReloadDirectories,
      )
    }
    junctionSource := &NativePluginSource{
      plugins: []NativeLSPPluginEntry{first},
    }
    junctionSource.storeProjectInputs(first, 1, snapshot)

    if err := os.Remove(junction); err != nil {
      t.Fatal(err)
    }
    deleted := fileChangeTypeDeleted
    if !junctionSource.ProjectInputReloadMatchesChange(
      testFileURI(junction),
      &deleted,
    ) {
      t.Fatal("junction reload directory deletion was not selected")
    }

    createProjectInputJunction(t, junction, secondTarget)
    if junctionSource.ProjectInputReloadFingerprintsAreCurrent() {
      t.Fatal("same-topology junction retarget kept startup fingerprint current")
    }
    changed := fileChangeTypeChanged
    if !junctionSource.ProjectInputReloadMatchesChange(
      testFileURI(junction),
      &changed,
    ) {
      t.Fatal("junction reload directory retarget was not selected")
    }
  })
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
  observation := e2etrace.BeginCommand(command, "CombinedOutput")
  output, err := command.CombinedOutput()
  observation.Result(err)
  if err != nil {
    t.Skipf(
      "per-directory case-sensitivity fixture setup failed: %v\n%s",
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
  observation := e2etrace.BeginCommand(command, "CombinedOutput")
  output, err := command.CombinedOutput()
  observation.Result(err)
  if err != nil {
    t.Fatalf("failed to disable per-directory case sensitivity: %v\n%s", err, output)
  }
}

func createProjectInputJunction(
  t *testing.T,
  junction string,
  target string,
) {
  t.Helper()
  command := exec.Command(
    "cmd.exe",
    "/d",
    "/c",
    "mklink",
    "/J",
    junction,
    target,
  )
  observation := e2etrace.BeginCommand(command, "CombinedOutput")
  output, err := command.CombinedOutput()
  observation.Result(err)
  if err != nil {
    t.Skipf("directory-junction fixture setup failed: %v\n%s", err, output)
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
