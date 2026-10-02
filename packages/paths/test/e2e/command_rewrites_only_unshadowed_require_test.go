//go:build e2e

package paths_test

import (
  "os/exec"
  "path/filepath"
  "strings"
  "testing"

  shared "github.com/samchon/ttsc/packages/paths/test/internal/shared"
)

// TestCommandRewritesOnlyUnshadowedRequire verifies paths rewrites only the CommonJS loader.
//
// The identifier spelling alone cannot distinguish the global loader from a
// parameter, local, or imported binding. The emitted program must preserve
// those callback arguments because changing them alters observable results.
//
// 1. Build one project with ambient, parameter, local, and imported require calls.
// 2. Assert only the ambient loader's emitted argument became a relative path.
// 3. Execute the emitted modules and assert each shadowed call returns its original value.
// @evidence contracts/testing.md#behavioral-verification One NodeNext project emits ambient and unbound requires as ./lib/message.cjs while parameter/local/imported bindings retain @lib/message; real Node then returns the exact five-element authored result array.
// @evidence contracts/testing.md#independent-expectations CommonJS target suffix and lexical binding semantics independently require loader rewrites and preservation of shadowed callback arguments. The literal runtime array detects changed program meaning.
// @evidence contracts/testing.md#distinguishing-cases Ambient declaration and unbound identifiers change; parameter, local and imported require bindings must not. The emitted Node execution checks both loader results and shadowed values.
// @evidence contracts/testing.md#execution-ownership The discoverable TestCommandRewritesOnlyUnshadowedRequire entry runs in the paths E2E population and calls the real compiled package sidecar; runPlugin captures its native exit and separate streams. This classification does not move its portable assertions into units.
// @evidence contracts/e2e.md#necessary-boundary The native compiler rewrite, emit and actual Node module loader connect here. Direct AST assertions cannot prove that the published program still executes the intended shadowed bindings.
// @evidence contracts/e2e.md#shared-execution runPlugin reaches the compiled sidecar through resolvePluginBinary, which builds ./plugin once per test process under sync.Once unless TTSC_UTILITY_TEST_BINARY names a prebuilt binary; this function starts one build process, followed by one node child that runs the emitted modules, from that binary and shares no loaded project or running session with any other entry.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity shared.SeedProject writes the fixture under t.TempDir, removed at cleanup; the build exits before the body writes dist/runner.mjs into the emitted output tree and starts the node child there. TestMain removes only the fallback producer directory after m.Run. No cold or invalidated state is exercised.
// @evidence contracts/e2e.md#preserved-coverage The build status/stream check, loader/unbound rewrite checks, shadowed-output retention checks and the Node-executed result array are all made in this body.
func TestCommandRewritesOnlyUnshadowedRequire(t *testing.T) {
  root := shared.SeedProject(t, map[string]string{
    "package.json":        `{"type":"module"}` + "\n",
    "tsconfig.json":       `{"compilerOptions":{"target":"ES2022","module":"nodenext","moduleResolution":"nodenext","strict":true,"paths":{"@lib/*":["./src/lib/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/lib/message.cts": `export const message = "ok";` + "\n",
    "src/loader.ts": `declare function require(id: string): { message: string };
export const loaded = require("@lib/message").message;
`,
    "src/unbound.ts": `// @ts-nocheck
export const loaded = require("@lib/message").message;
`,
    "src/parameter.ts": `export const value = (require: (id: string) => string): string => require("@lib/message");
`,
    "src/local.ts": `export function value(): string {
  const require = (id: string): string => "local:" + id;
  return require("@lib/message");
}
`,
    "src/shadow.ts": `export const require = (id: string): string => "imported:" + id;
`,
    "src/imported.ts": `import { require } from "./shadow.js";
export const value = require("@lib/message");
`,
  })

  code, stdout, stderr := runPlugin(t, "build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--emit", "--quiet")
  if code != 0 || stdout != "" || stderr != "" {
    t.Fatalf("build branch mismatch: code=%d stdout=%q stderr=%q", code, stdout, stderr)
  }

  loader := readFile(t, filepath.Join(root, "dist", "loader.js"))
  if !strings.Contains(loader, `require("./lib/message.cjs")`) {
    t.Fatalf("ambient loader did not rewrite:\n%s", loader)
  }
  unbound := readFile(t, filepath.Join(root, "dist", "unbound.js"))
  if !strings.Contains(unbound, `require("./lib/message.cjs")`) {
    t.Fatalf("unbound loader did not rewrite:\n%s", unbound)
  }
  for _, file := range []string{"parameter.js", "local.js", "imported.js"} {
    output := readFile(t, filepath.Join(root, "dist", file))
    if !strings.Contains(output, `@lib/message`) {
      t.Fatalf("shadowed require in %s was rewritten:\n%s", file, output)
    }
  }

  writeFile(t, filepath.Join(root, "dist", "runner.mjs"), `import { createRequire } from "node:module";
globalThis.require = createRequire(import.meta.url);
const parameter = await import("./parameter.js");
const local = await import("./local.js");
const imported = await import("./imported.js");
const loader = await import("./loader.js");
const unbound = await import("./unbound.js");
process.stdout.write(JSON.stringify([
  parameter.value((id) => id),
  local.value(),
  imported.value,
  loader.loaded,
  unbound.loaded,
]));
`)
  command := exec.Command("node", "runner.mjs")
  command.Dir = filepath.Join(root, "dist")
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("emitted require cases did not run: %v\n%s", err, output)
  }
  if got, want := strings.TrimSpace(string(output)), `["@lib/message","local:@lib/message","imported:@lib/message","ok","ok"]`; got != want {
    t.Fatalf("emitted require results mismatch: got %s, want %s", got, want)
  }
}
