package paths_test

import (
  "path/filepath"
  "reflect"
  "testing"

  shimast "github.com/microsoft/typescript-go/shim/ast"

  _ "github.com/samchon/ttsc/packages/paths/driver"
  "github.com/samchon/ttsc/packages/ttsc/driver"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals verifies actual parsed module literals and lexical loader bindings.
//
// Helper resolution tests do not dispatch the syntax visitor or consult the
// compiler's symbols. This case calls the registered paths implementation through
// Program.ApplyLinkedPlugins and inspects its owned AST before printing or emit.
//
// 1. Parse alias imports, exports, type imports, augmentations and loader calls alongside unchanged literals.
// 2. Apply the linked paths plugin once through the existing driver entry.
// 3. Compare complete literal sequences and node identities with independently authored expectations.
//
// @evidence contracts/testing.md#behavioral-verification LoadProgram and ApplyLinkedPlugins execute the actual paths ApplyProgram visitor on compiler-parsed sources. Complete literal sequences distinguish static/named/type exports, import-equals, import types, dynamic import and ambient/unbound require rewrites from ordinary calls, property require, relative imports, unmatched names and shadowed loader bindings; original literal node identities must survive.
// @evidence contracts/testing.md#independent-expectations The fixture rootDir/outDir contract places message, exact and pkg/index at literal ./modules/message.js, ./modules/exact.js and ./pkg/index.js. TypeScript lexical binding and global ambient-module semantics require the authored negative strings to remain; no paths helper computes expectations. These AST assertions do not prove serialized JS/declaration acceptance, which separate emit and plugin-free recheck units exercise, or Node execution, which remains in E2E.
// @evidence contracts/testing.md#distinguishing-cases A missing first wildcard target precedes the real source; every eligible syntax form changes while fn/obj.require, relative and unmatched specifiers do not. External-module augmentation changes but the same global-script declaration does not. Ambient and unresolved require change, while parameter, local and imported require retain their argument. Existing resolution-helper units own their separate precedence/extension matrices.
// @evidence contracts/testing.md#execution-ownership Named unit entry TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals is in test/unit for the utility overlay. One noLib single-threaded compiler Program and its actual checker execute in this Go process, with fixture-owned linked manifest restored by t.Setenv and checker lease released by Close; no registry replacement, private linkname, native producer or subprocess is used.
func TestLinkedProgramRewritesModuleSyntaxWithoutChangingOtherLiterals(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":          `{"compilerOptions":{"target":"ES2022","module":"ES2022","noLib":true,"rootDir":"src","outDir":"dist","paths":{"@pkg":["./src/pkg"],"@lib/exact":["./src/modules/exact.ts"],"@lib/*":["./src/missing/*","./src/modules/*"]}},"include":["src"]}`,
    "src/modules/message.ts": `export interface MessageBox { value: string }; export const message = 1;`,
    "src/modules/exact.ts":   `export const exact = 2;`,
    "src/pkg/index.ts":       `export const index = 3;`,
    "src/main.ts": `declare const require: (id: string) => unknown;
import { message } from "@lib/message";
import { exact } from "@lib/exact";
import { index } from "@pkg";
import messageModule = require("@lib/message");
export { message } from "@lib/message";
export type { MessageBox } from "@lib/message";
export type ImportedBox = import("@lib/message").MessageBox;
export const loaded = require("@lib/message");
export async function loadMessage() { return import("@lib/message"); }
declare module "@lib/message" { export const augmented: string; }
declare function fn(value: string): void;
declare const obj: { require(id: string): void };
fn("@lib/message");
obj.require("@lib/message");
import "./modules/message.js";
declare module "@unmatched/name" {}
namespace UntouchedNamespace {}
export const value = message + exact + index;
void messageModule;`,
    "src/ambient.ts":   `declare function require(id: string): unknown; export const value = require("@lib/message");`,
    "src/unbound.ts":   `export const value = require("@lib/message");`,
    "src/parameter.ts": `export const value = (require: (id: string) => string) => require("@lib/message");`,
    "src/local.ts":     `export function value() { const require = (id: string) => id; return require("@lib/message"); }`,
    "src/shadow.ts":    `export const require = (id: string) => id;`,
    "src/imported.ts":  `import { require } from "./shadow.js"; export const value = require("@lib/message");`,
    "src/global.ts":    `declare module "@lib/message" { export const value: number; }`,
  })
  t.Setenv(driver.LinkedPluginsEnv, `[{"name":"@ttsc/paths","stage":"transform","config":{"transform":"@ttsc/paths"}}]`)
  prog, diagnostics, err := driver.LoadProgram(root, filepath.Join(root, "tsconfig.json"), driver.LoadProgramOptions{SingleThreaded: true, ForceNoEmit: true, TsgoArgs: []string{}})
  if err != nil || len(diagnostics) != 0 || prog == nil {
    t.Fatalf("load parsed fixture: program=%v diagnostics=%v error=%v", prog != nil, diagnostics, err)
  }
  defer prog.Close()
  collect := func(file *shimast.SourceFile) []*shimast.Node {
    var literals []*shimast.Node
    var visit func(*shimast.Node) bool
    visit = func(node *shimast.Node) bool {
      if node.Kind == shimast.KindStringLiteral {
        literals = append(literals, node)
      }
      node.ForEachChild(visit)
      return false
    }
    visit(file.AsNode())
    return literals
  }
  before := make(map[string][]*shimast.Node)
  for _, file := range prog.TSProgram.SourceFiles() {
    before[filepath.Base(file.FileName())] = collect(file)
  }
  expected := map[string][]string{
    "main.ts":      {"./modules/message.js", "./modules/exact.js", "./pkg/index.js", "./modules/message.js", "./modules/message.js", "./modules/message.js", "./modules/message.js", "./modules/message.js", "./modules/message.js", "./modules/message.js", "@lib/message", "@lib/message", "./modules/message.js", "@unmatched/name"},
    "ambient.ts":   {"./modules/message.js"},
    "unbound.ts":   {"./modules/message.js"},
    "parameter.ts": {"@lib/message"},
    "local.ts":     {"@lib/message"},
    "imported.ts":  {"./shadow.js", "@lib/message"},
    "global.ts":    {"@lib/message"},
  }
  if err := prog.ApplyLinkedPlugins(); err != nil {
    t.Fatal(err)
  }
  seen := make(map[string]bool)
  for _, file := range prog.TSProgram.SourceFiles() {
    name := filepath.Base(file.FileName())
    want, checked := expected[name]
    if !checked {
      continue
    }
    seen[name] = true
    after := collect(file)
    if len(after) != len(before[name]) {
      t.Fatalf("%s replaced or reordered original literal nodes", name)
    }
    for i, node := range after {
      if node != before[name][i] {
        t.Fatalf("%s replaced or reordered original literal node %d", name, i)
      }
    }
    got := make([]string, len(after))
    for i, node := range after {
      got[i] = node.Text()
    }
    if !reflect.DeepEqual(got, want) {
      t.Errorf("%s literal sequence: got %#v, want %#v", name, got, want)
    }
  }
  for name := range expected {
    if !seen[name] {
      t.Errorf("parsed source %s was not inspected", name)
    }
  }
}
