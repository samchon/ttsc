package paths_test

import (
  "path/filepath"
  "reflect"
  "regexp"
  "testing"

  shimcompiler "github.com/microsoft/typescript-go/shim/compiler"
  shimtspath "github.com/microsoft/typescript-go/shim/tspath"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestLinkedProgramRewritesDottedBasenamesAndRootedConfigDirTargets verifies alias lookup for dotted file names and expanded `${configDir}` targets.
//
// A Nest-style `user.service.ts` has a dot inside its stem, and a `${configDir}`
// substitution target is already an absolute path once the compiler has
// expanded it. A helper-level source map cannot show that the compiler's parsed
// options reach the rewriter in these shapes, so this case emits real
// JavaScript through the registered paths plugin in this process.
//
// 1. Load one project whose aliases name a dotted stem, an explicit extension on that stem, an expanded `${configDir}` target and a missing dotted stem.
// 2. Apply the linked paths plugin and capture the compiler's emitted CommonJS.
// 3. Compare the complete ordered `require` specifiers with literal expectations.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram, ApplyLinkedPlugins and EmitAllRaw run the real compiler and registered paths plugin, then the ordered require specifiers of main.js are compared whole. A dotted stem without an extension, the same stem with an explicit .js suffix and a `${configDir}`-rooted target all become relative .js paths, so a lookup that strips the dotted suffix or appends a rooted target to the paths base fails.
// @evidence contracts/testing.md#independent-expectations The authored src layout and the rootDir src to outDir dist mapping fix the literal ./users/user.service.js and ./plain.js outputs, and TypeScript's own resolution of an extensionless dotted candidate (appending source extensions to the whole name) supplies the rule for the dotted case. No paths helper computes an expectation, and the emitted text is not executed.
// @evidence contracts/testing.md#distinguishing-cases The rewritten dotted and rooted cases sit beside a dotted alias with no source behind it, which must keep its authored specifier, so unconditional rewriting of dotted aliases fails. Case policy, pattern precedence and module syntax forms are owned by sibling cases.
// @evidence contracts/testing.md#execution-ownership This named test/unit entry joins the shared utility Go process with one noLib single-threaded Program on the default filesystem, a t-owned temporary project, a t.Setenv-restored linked manifest and a checker lease released by Close. No native producer, installer or subprocess is involved.
func TestLinkedProgramRewritesDottedBasenamesAndRootedConfigDirTargets(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":             `{"compilerOptions":{"target":"ES2022","module":"CommonJS","moduleResolution":"Bundler","noLib":true,"paths":{"@/*":["${configDir}/src/*"],"@rel/*":["./src/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/users/user.service.ts": `export const service = 1;`,
    "src/plain.ts":              `export const plain = 2;`,
    "src/main.ts": `import { service as dotted } from "@rel/users/user.service";
import { service as explicit } from "@rel/users/user.service.js";
import { service as rooted } from "@/users/user.service";
import { plain } from "@/plain";
import { missing } from "@rel/users/missing.service";
export const value = [dotted, explicit, rooted, plain, missing];`,
  })
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"@ttsc/paths","stage":"transform","config":{"transform":"@ttsc/paths"}}]`)
  prog, diagnostics, err := driver.LoadProgram(root, filepath.Join(root, "tsconfig.json"), driver.LoadProgramOptions{SingleThreaded: true, ForceEmit: true, TsgoArgs: []string{}})
  if err != nil || len(diagnostics) != 0 || prog == nil {
    t.Fatalf("load: program=%v diagnostics=%v error=%v", prog != nil, diagnostics, err)
  }
  defer prog.Close()
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
  var got []string
  for _, match := range regexp.MustCompile(`require\("([^"]*)"\)`).FindAllStringSubmatch(output, -1) {
    got = append(got, match[1])
  }
  want := []string{"./users/user.service.js", "./users/user.service.js", "./users/user.service.js", "./plain.js", "@rel/users/missing.service"}
  if !reflect.DeepEqual(got, want) {
    t.Errorf("require specifiers: got %#v, want %#v in %s", got, want, output)
  }
}
