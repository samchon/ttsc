package paths_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimvfs "github.com/microsoft/typescript-go/shim/vfs"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver"
)

// TestLinkedProgramRewritesCaseOnlyTargetsByHostPolicy verifies compiler-backed alias rewriting under both filesystem policies.
//
// A synthetic rewriter index does not prove that newRewriter receives the
// compiler filesystem's authority. LoadProgram's supported FS input supplies
// fixed fixture bytes and policy to the real compiler and registered plugin;
// emission remains in this process rather than building a native consumer.
//
// 1. Load the original four uppercase aliases and lowercase sources under sensitive and insensitive fixture filesystems.
// 2. Apply the registered paths plugin and capture the compiler's actual JavaScript emission.
// 3. Assert four literal runtime paths only under insensitive authority, with unchanged aliases under sensitive authority.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram, ApplyLinkedPlugins and EmitAllRaw execute the real compiler and paths plugin through the supported FS seam. Exact, extensionless, explicit-extension and directory-index aliases become ./exact.js, ./extensionless.js, ./explicit.js and ./directory/index.js only under insensitive policy; the sensitive program retains each unresolved alias and both outputs retain the authored exported value expression.
// @evidence contracts/testing.md#independent-expectations The fixed lowercase files and rootDir/src to outDir/dist contract independently establish four literal relative outputs, compared without case exactly as the original insensitive-host assertion permitted. Sensitive authority cannot resolve the uppercase candidates; no paths source-key or lookup helper computes expectations. CommonJS must preserve the four imported property names and their addition order, independently of compiler-generated module variable names. The fixture FS supplies authored bytes and file identities, not compiler or plugin results. The additional export regex checks property order without executing JavaScript or proving every emitted binding relationship.
// @evidence contracts/testing.md#distinguishing-cases The same source and four alias shapes run under both policies, rejecting unconditional case folding and failure to transfer insensitive authority. Sources are explicitly enrolled under their original spelling, so host identity controls alias matching rather than whether an input was discovered. test_installed_compiler_resolves_case_only_imports_with_its_host_policy in the sole installed SDK setup batch owns agreement with the actual ordinary volume and candidate compiler authority, which this controlled FS cannot establish. This test retains the original native consumer's four literal runtime-path checks and absence of aliases on insensitive authority, adds sensitive authority, and removes its platform skip without claiming a native plugin transport check.
// @evidence contracts/testing.md#execution-ownership This named test/unit entry joins the shared utility Go process. Two noLib single-threaded Programs use the documented LoadProgramOptions.FS seam and actual registered paths implementation, capture emitted bytes in memory and release checker leases with Close. The temporary authored fixture is t-owned; no product host, native build, installer, subprocess, private linkname or registry replacement is involved.
func TestLinkedProgramRewritesCaseOnlyTargetsByHostPolicy(t *testing.T) {
  files := map[string]string{
    "tsconfig.json": `{"compilerOptions":{"target":"ES2022","module":"CommonJS","noLib":true,"forceConsistentCasingInFileNames":false,"paths":{"@exact":["./SRC/EXACT.ts"],"@extensionless":["./SRC/EXTENSIONLESS"],"@explicit":["./SRC/EXPLICIT.ts"],"@directory":["./SRC/DIRECTORY"]},"outDir":"dist","rootDir":"src"},"files":["src/main.ts","src/exact.ts","src/extensionless.ts","src/explicit.ts","src/directory/index.ts"]}`,
    "src/exact.ts": `export const exact = "exact";`,
    "src/extensionless.ts": `export const extensionless = "extensionless";`,
    "src/explicit.ts": `export const explicit = "explicit";`,
    "src/directory/index.ts": `export const directory = "directory";`,
    "src/main.ts": `import { exact } from "@exact";
import { extensionless } from "@extensionless";
import { explicit } from "@explicit";
import { directory } from "@directory";
export const value = exact + extensionless + explicit + directory;`,
  }
  root := seedProject(t, files)
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"@ttsc/paths","stage":"transform","config":{"transform":"@ttsc/paths"}}]`)
  for _, sensitive := range []bool{true, false} {
    t.Run(map[bool]string{true: "sensitive", false: "insensitive"}[sensitive], func(t *testing.T) {
      filesystem := &pathsCaseFixtureFS{FS: driver.DefaultFS(), root: filepath.ToSlash(root), sensitive: sensitive, files: map[string]string{}}
      for name, contents := range files {
        filesystem.files[filepath.ToSlash(filepath.Join(root, name))] = contents
      }
      prog, diagnostics, err := driver.LoadProgram(root, filepath.Join(root, "tsconfig.json"), driver.LoadProgramOptions{FS: filesystem, SingleThreaded: true, ForceEmit: true, TsgoArgs: []string{}})
      if err != nil || len(diagnostics) != 0 || prog == nil {
        t.Fatalf("load: program=%v diagnostics=%v error=%v", prog != nil, diagnostics, err)
      }
      defer prog.Close()
      if prog.FS.UseCaseSensitiveFileNames() != sensitive {
        t.Fatal("loaded program lost its supplied filesystem policy")
      }
      if err := prog.ApplyLinkedPlugins(); err != nil {
        t.Fatal(err)
      }
      written := map[string]string{}
      _, diagnostics, err = prog.EmitAllRaw(func(name, contents string, _ *shimcompiler.WriteFileData) error {
        written[filepath.ToSlash(name)] = contents
        return nil
      })
      if err != nil || len(diagnostics) != 0 {
        t.Fatalf("emit: diagnostics=%v error=%v", diagnostics, err)
      }
      output, ok := written[filepath.ToSlash(filepath.Join(root, "dist/main.js"))]
      if !ok {
        t.Fatalf("missing emitted main.js: %v", written)
      }
      for _, entry := range [][2]string{{"@exact", "./exact.js"}, {"@extensionless", "./extensionless.js"}, {"@explicit", "./explicit.js"}, {"@directory", "./directory/index.js"}} {
        changed, unchanged := `require("`+entry[1]+`")`, `require("`+entry[0]+`")`
        if sensitive {
          changed, unchanged = unchanged, changed
        }
        if !strings.Contains(strings.ToLower(output), strings.ToLower(changed)) || strings.Contains(strings.ToLower(output), strings.ToLower(unchanged)) {
          t.Errorf("%s policy=%v: want %s and no %s in %s", entry[0], sensitive, changed, unchanged, output)
        }
      }
      if !regexp.MustCompile(`exports\.value = [\w$]+\.exact \+ [\w$]+\.extensionless \+ [\w$]+\.explicit \+ [\w$]+\.directory;`).MatchString(output) {
        t.Errorf("emit lost the authored export expression: %s", output)
      }
    })
  }
}

// pathsCaseFixtureFS supplies one authored input set to the compiler under an
// explicit case policy. It never changes the backing filesystem's capability:
// known fixture paths resolve from immutable inputs, and unrelated SDK paths
// retain the borrowed default filesystem. Program emission uses its own writer.
type pathsCaseFixtureFS struct {
  shimvfs.FS
  root string
  sensitive bool
  files map[string]string
}

func (fs *pathsCaseFixtureFS) UseCaseSensitiveFileNames() bool { return fs.sensitive }

func (fs *pathsCaseFixtureFS) fixturePath(name string) (string, bool) {
  name = filepath.ToSlash(filepath.Clean(name))
  for file := range fs.files {
    if file == name || (!fs.sensitive && strings.EqualFold(file, name)) {
      return file, true
    }
  }
  return "", false
}

func (fs *pathsCaseFixtureFS) owns(name string) bool {
  name = filepath.ToSlash(filepath.Clean(name))
  return strings.EqualFold(name, fs.root) || strings.HasPrefix(strings.ToLower(name), strings.ToLower(fs.root)+"/")
}

func (fs *pathsCaseFixtureFS) FileExists(name string) bool {
  if fs.owns(name) {
    _, ok := fs.fixturePath(name)
    return ok
  }
  return fs.FS.FileExists(name)
}

func (fs *pathsCaseFixtureFS) ReadFile(name string) (string, bool) {
  if fs.owns(name) {
    file, ok := fs.fixturePath(name)
    return fs.files[file], ok
  }
  return fs.FS.ReadFile(name)
}

func (fs *pathsCaseFixtureFS) DirectoryExists(name string) bool {
  if !fs.owns(name) { return fs.FS.DirectoryExists(name) }
  _, ok := fs.fixtureDirectory(name)
  return ok
}

func (fs *pathsCaseFixtureFS) fixtureDirectory(name string) (string, bool) {
  name = filepath.ToSlash(filepath.Clean(name))
  for file := range fs.files {
    for directory := filepath.ToSlash(filepath.Dir(file)); fs.owns(directory); directory = filepath.ToSlash(filepath.Dir(directory)) {
      if directory == name || !fs.sensitive && strings.EqualFold(directory, name) { return directory, true }
      if directory == fs.root { break }
    }
  }
  return "", false
}

func (fs *pathsCaseFixtureFS) GetAccessibleEntries(name string) shimvfs.Entries {
  if !fs.owns(name) { return fs.FS.GetAccessibleEntries(name) }
  if directory, ok := fs.fixtureDirectory(name); ok { return fs.FS.GetAccessibleEntries(directory) }
  return shimvfs.Entries{}
}

func (fs *pathsCaseFixtureFS) Stat(name string) shimvfs.FileInfo {
  if !fs.owns(name) { return fs.FS.Stat(name) }
  if file, ok := fs.fixturePath(name); ok { return fs.FS.Stat(file) }
  if directory, ok := fs.fixtureDirectory(name); ok { return fs.FS.Stat(directory) }
  return nil
}

func (fs *pathsCaseFixtureFS) Realpath(name string) string {
  if fs.owns(name) {
    if file, ok := fs.fixturePath(name); ok { return file }
    if directory, ok := fs.fixtureDirectory(name); ok { return fs.FS.Realpath(directory) }
    return ""
  }
  return fs.FS.Realpath(name)
}
