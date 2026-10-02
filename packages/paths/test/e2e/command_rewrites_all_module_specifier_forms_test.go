//go:build e2e

package paths_test

import (
  "encoding/json"
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestCommandRewritesAllModuleSpecifierForms verifies visitor coverage across syntax forms.
//
// The paths plugin walks several AST shapes, not just static import
// declarations. This fixture keeps those visitor branches observable through
// transform output so runtime imports, type imports, ambient modules, and
// non-module calls cannot regress independently.
//
// 1. Create a project with aliases used in every supported specifier form.
// 2. Run transform through the real sidecar so the compiler parses the source.
// 3. Assert each alias form is rewritten and non-module calls are ignored.
// @evidence contracts/testing.md#behavioral-verification Transform JSON for one source rewrites static imports and re-exports, import-equals and bare require (the original = require("@lib/message") spelling must be absent), dynamic imports, type imports and external-module augmentation to .js-relative specifiers; fn("@lib/message"), obj.require("@lib/message"), a namespace and an unmatched declared module remain. Two later check --quiet runs over no-rootDir projects (include list, and files list with an external file) must succeed silently.
// @evidence contracts/testing.md#independent-expectations The authored path mappings yield literal .js-relative specifiers, while non-module expressions retain their original authored text. Returned text is checked rather than evaluated.
// @evidence contracts/testing.md#distinguishing-cases The fixture distinguishes supported module syntax from fn calls, obj.require and unmatched declarations, then checks local and external files lists without rootDir. It does not independently prove runtime behavior for every syntax form.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRewritesAllModuleSpecifierForms entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The real compiler parses all authored forms and the sidecar transports their transformed text. Portable visitor semantics and root inference still account for much of this case; three native calls are retained without claiming that each is a minimal boundary.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts three processes (one transform, two check runs over different projects) from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity Three projects are seeded with shared.SeedProject plus one external directory from t.TempDir; all are removed at test cleanup and each process exits before the next starts. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The transform status/stderr and JSON decode, the leaked-alias loop, rewritten-specifier loop, the three untouched-form checks and the two check runs are all made in this body; text presence does not prove the rewritten specifiers resolve at runtime.
func TestCommandRewritesAllModuleSpecifierForms(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "tsconfig.json":        `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"],"@types/*":["./src/types/*"],"@ambient/*":["./src/ambient/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/lib/message.ts":   `export const message = "ok";` + "\n",
    "src/types/box.ts":     `export interface Box { value: string }` + "\n",
    "src/ambient/thing.ts": `export {};` + "\n",
    "src/main.ts": `// @ts-nocheck
import { message } from "@lib/message";
export { message as exported } from "@lib/message";
import messageModule = require("@lib/message");
declare function require(id: string): unknown;
const required = require("@lib/message");
async function load() { return import("@lib/message"); }
type Box = import("@types/box").Box;
declare module "@ambient/thing" { export const ambient: string; }
declare function fn(value: string): void;
declare const obj: { require(id: string): void };
namespace UntouchedNamespace {}
declare module "@unmatched/name" {}
fn("@lib/message");
obj.require("@lib/message");
export const value = message;
void messageModule;
void required;
void load;
`,
  })

  code, stdout, stderr := runPlugin(t, "transform", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t))
  if code != 0 || stderr != "" {
    t.Fatalf("transform branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
  var result transformResult
  if err := json.Unmarshal([]byte(strings.TrimSpace(stdout)), &result); err != nil {
    t.Fatalf("transform output is not JSON: %v\n%s", err, stdout)
  }
  main := result.TypeScript["src/main.ts"]
  for _, alias := range []string{`from "@lib/message"`, `import("@lib/message")`, `import("@types/box")`, `module "@ambient/thing"`, `= require("@lib/message")`} {
    if strings.Contains(main, alias) {
      t.Fatalf("alias %s leaked into transform output:\n%s", alias, main)
    }
  }
  for _, rewritten := range []string{`from "./lib/message.js"`, `require("./lib/message.js")`, `import("./lib/message.js")`, `import("./types/box.js")`, `module "./ambient/thing.js"`} {
    if !strings.Contains(main, rewritten) {
      t.Fatalf("missing rewritten specifier %s:\n%s", rewritten, main)
    }
  }
  if !strings.Contains(main, `fn("@lib/message")`) {
    t.Fatalf("non-module call should stay untouched:\n%s", main)
  }
  if !strings.Contains(main, `obj.require("@lib/message")`) {
    t.Fatalf("property access call should stay untouched:\n%s", main)
  }
  if !strings.Contains(main, `namespace UntouchedNamespace`) || !strings.Contains(main, `module "@unmatched/name"`) {
    t.Fatalf("non-module and unmatched declarations should stay untouched:\n%s", main)
  }

  localNoRootDir := shared.SeedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]}},"include":["src"]}`,
    "src/lib/message.ts": `export const message = "ok";` + "\n",
    "src/main.ts":        `import { message } from "@lib/message";` + "\n" + `export const value = message;` + "\n",
  })
  code, stdout, stderr = runPlugin(t, "check", "--cwd="+localNoRootDir, "--tsconfig="+filepath.Join(localNoRootDir, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("local no-rootDir check mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  // A sibling temp dir keeps the file outside the tsconfig directory: a
  // fixture inside the package directory leaks into the tree when the test
  // dies mid-run. The cross-volume shape this fixture once accidentally hit
  // (#310) is pinned by TestCommandCheckCompletesOnCrossVolumeFilesList.
  externalDir := t.TempDir()
  externalFile := filepath.Join(externalDir, "external.ts")
  writeFile(t, externalFile, `export const external = "ok";`+"\n")
  noRootDir := shared.SeedProject(t, map[string]string{
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"commonjs","strict":true,"paths":{"@lib/*":["./src/lib/*"]}},"files":["src/main.ts","src/lib/message.ts",` + mustJSON(t, externalFile) + `]}`,
    "src/lib/message.ts": `export const message = "ok";` + "\n",
    "src/main.ts":        `import { message } from "@lib/message";` + "\n" + `export const value = message;` + "\n",
  })
  code, stdout, stderr = runPlugin(t, "check", "--cwd="+noRootDir, "--tsconfig="+filepath.Join(noRootDir, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("no-rootDir check mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }
}
