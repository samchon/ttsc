package paths_test

import (
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
// 3. Assert every shadowed call keeps its original argument; execution of the emitted modules is owned by the paths_rewrites_only_unshadowed_require scene in tests/test-e2e.
//
// @evidence contracts/testing.md#behavioral-verification One NodeNext project emits ambient and unbound requires as ./lib/message.cjs while parameter/local/imported bindings retain @lib/message; the emitted modules are not executed here, which tests/test-e2e owns.
// @evidence contracts/testing.md#independent-expectations CommonJS target suffix and lexical binding semantics independently require loader rewrites and preservation of shadowed callback arguments.
// @evidence contracts/testing.md#distinguishing-cases Ambient declaration and unbound identifiers change; parameter, local and imported require bindings must not. The emitted text shows which calls changed; runtime values are owned by the E2E scene.
// @evidence contracts/testing.md#execution-ownership The named entry is in test/unit and calls utility.RunCommandWithIO, the dispatch the standalone main delegates to, in this Go process with the paths plugin linked by the driver import and a t-owned fixture project; no built binary or child process is started.
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

  code, stdout, stderr := runCommand("build", "--cwd="+root, "--tsconfig="+filepath.Join(root, "tsconfig.json"), "--plugins-json="+pathsManifest(t), "--emit", "--quiet")
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
}
