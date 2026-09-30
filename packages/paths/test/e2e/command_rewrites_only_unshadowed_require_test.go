package paths_test

import (
  "os/exec"
  "path/filepath"
  "strings"
  "testing"
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
// @evidence contracts/e2e.md#shared-execution All paths command entries use resolvePluginBinary once per test process, or the suite-supplied immutable producer. This case starts independent command consumers with the exact arguments above; only binary bytes are shared, not a loaded project or process session.
// @evidence contracts/e2e.md#state-isolation-and-reuse-validity For TestCommandRewritesOnlyUnshadowedRequire, command exits release each process; t.TempDir owns any fixture and output tree until case cleanup. TestMain owns only a fallback producer directory, while a supplied binary is runner-owned. No cold/invalidation transition is asserted here.
// @evidence contracts/e2e.md#preserved-coverage The existing TestCommandRewritesOnlyUnshadowedRequire inputs, statuses, stream checks and any output assertions remain executable in this entry unchanged. No portable owner is inferred merely from another unit suite, and further reduction requires an exact assertion transfer.
func TestCommandRewritesOnlyUnshadowedRequire(t *testing.T) {
  root := seedProject(t, map[string]string{
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
