package paths_test

import (
  "path/filepath"
  "regexp"
  "strings"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"
  shimvfs "github.com/microsoft/typescript-go/shim/vfs"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
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
// @evidence contracts/testing.md#independent-expectations The authored lowercase files and the rootDir src to outDir dist layout establish the four literal relative outputs ./exact.js, ./extensionless.js, ./explicit.js and ./directory/index.js; the comparison lowercases both sides so only the specifier shape, not path spelling, is asserted. Sensitive authority cannot resolve the uppercase candidates, so the unchanged aliases are the expectation there; no paths source-key or lookup helper computes any expectation. A regex on the emitted CommonJS checks that the four imported property names keep their addition order without depending on compiler-generated module variable names; it does not execute the JavaScript. The fixture FS supplies authored bytes and file identities, not compiler or plugin results.
// @evidence contracts/testing.md#distinguishing-cases The same sources and four alias shapes run under a case-sensitive and a case-insensitive fixture filesystem, so unconditional case folding and ignoring the Program's filesystem policy each fail one subtest. The sources are listed in the tsconfig files array under their lowercase spelling, so the filesystem policy decides alias matching rather than whether an input was discovered. This controlled filesystem cannot establish the policy of a real volume; case_installed_compiler_resolves_case_only_imports_with_its_host_policy in the installation E2E owns that agreement.
// @evidence contracts/testing.md#execution-ownership This named test/unit entry joins the shared utility Go process. Two noLib single-threaded Programs use the documented LoadProgramOptions.FS seam and actual registered paths implementation, capture emitted bytes in memory and release checker leases with Close. The temporary authored fixture is t-owned; no product host, native build, installer, subprocess, private linkname or registry replacement is involved.
func TestLinkedProgramRewritesCaseOnlyTargetsByHostPolicy(t *testing.T) {
  files := map[string]string{
    "tsconfig.json":          `{"compilerOptions":{"target":"ES2022","module":"CommonJS","noLib":true,"forceConsistentCasingInFileNames":false,"paths":{"@exact":["./SRC/EXACT.ts"],"@extensionless":["./SRC/EXTENSIONLESS"],"@explicit":["./SRC/EXPLICIT.ts"],"@directory":["./SRC/DIRECTORY"]},"outDir":"dist","rootDir":"src"},"files":["src/main.ts","src/exact.ts","src/extensionless.ts","src/explicit.ts","src/directory/index.ts"]}`,
    "src/exact.ts":           `export const exact = "exact";`,
    "src/extensionless.ts":   `export const extensionless = "extensionless";`,
    "src/explicit.ts":        `export const explicit = "explicit";`,
    "src/directory/index.ts": `export const directory = "directory";`,
    "src/main.ts": `import { exact } from "@exact";
import { extensionless } from "@extensionless";
import { explicit } from "@explicit";
import { directory } from "@directory";
export const value = exact + extensionless + explicit + directory;`,
  }
  root := shared.SeedProject(t, files)
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
      if prog.FS.CaseSensitivity().IsCaseSensitive() != sensitive {
        t.Fatal("loaded program lost its supplied filesystem policy")
      }
      if err := prog.ApplyLinkedPlugins(); err != nil {
        t.Fatal(err)
      }
      written := map[string]string{}
      _, diagnostics, err = prog.EmitAllRaw(func(name shimtspath.RootedFilePath, contents string, _ *shimcompiler.WriteFileData) error {
        written[filepath.ToSlash(name.AsString())] = contents
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
        if !sensitive && strings.Contains(output, entry[0]) {
          t.Errorf("insensitive emit retained alias %s anywhere in output: %s", entry[0], output)
        }
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
  root      string
  sensitive bool
  files     map[string]string
}

func (fs *pathsCaseFixtureFS) CaseSensitivity() shimtspath.CaseSensitivity {
  if fs.sensitive {
    return shimtspath.CaseSensitive
  }
  return shimtspath.CaseInsensitive
}

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

func (fs *pathsCaseFixtureFS) FileExists(name shimtspath.RootedFilePath) bool {
  if fs.owns(name.AsString()) {
    _, ok := fs.fixturePath(name.AsString())
    return ok
  }
  return fs.FS.FileExists(name)
}

func (fs *pathsCaseFixtureFS) ReadFile(name shimtspath.RootedFilePath) (string, bool) {
  if fs.owns(name.AsString()) {
    file, ok := fs.fixturePath(name.AsString())
    return fs.files[file], ok
  }
  return fs.FS.ReadFile(name)
}

func (fs *pathsCaseFixtureFS) DirectoryExists(name shimtspath.RootedDirectoryPath) bool {
  if !fs.owns(name.AsString()) {
    return fs.FS.DirectoryExists(name)
  }
  _, ok := fs.fixtureDirectory(name.AsString())
  return ok
}

func (fs *pathsCaseFixtureFS) fixtureDirectory(name string) (string, bool) {
  name = filepath.ToSlash(filepath.Clean(name))
  for file := range fs.files {
    for directory := filepath.ToSlash(filepath.Dir(file)); fs.owns(directory); directory = filepath.ToSlash(filepath.Dir(directory)) {
      if directory == name || !fs.sensitive && strings.EqualFold(directory, name) {
        return directory, true
      }
      if directory == fs.root {
        break
      }
    }
  }
  return "", false
}

func (fs *pathsCaseFixtureFS) GetAccessibleEntries(name shimtspath.RootedDirectoryPath) shimvfs.Entries {
  if !fs.owns(name.AsString()) {
    return fs.FS.GetAccessibleEntries(name)
  }
  if directory, ok := fs.fixtureDirectory(name.AsString()); ok {
    return fs.FS.GetAccessibleEntries(shimtspath.RootedDirectoryPathFromNormalized(directory))
  }
  return shimvfs.Entries{}
}

func (fs *pathsCaseFixtureFS) Stat(name shimtspath.RootedPath) shimvfs.FileInfo {
  if !fs.owns(name.AsString()) {
    return fs.FS.Stat(name)
  }
  if file, ok := fs.fixturePath(name.AsString()); ok {
    return fs.FS.Stat(shimtspath.RootedPathFromNormalized(file))
  }
  if directory, ok := fs.fixtureDirectory(name.AsString()); ok {
    return fs.FS.Stat(shimtspath.RootedPathFromNormalized(directory))
  }
  return nil
}

func (fs *pathsCaseFixtureFS) Realpath(name shimtspath.RootedPath) shimtspath.RootedPath {
  if fs.owns(name.AsString()) {
    if file, ok := fs.fixturePath(name.AsString()); ok {
      return shimtspath.RootedPathFromNormalized(file)
    }
    if directory, ok := fs.fixtureDirectory(name.AsString()); ok {
      return fs.FS.Realpath(shimtspath.RootedPathFromNormalized(directory))
    }
    return ""
  }
  return fs.FS.Realpath(name)
}
