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
func TestCommandRewritesOnlyUnshadowedRequire(t *testing.T) {
  root := seedProject(t, map[string]string{
    "package.json":       `{"type":"module"}` + "\n",
    "tsconfig.json":      `{"compilerOptions":{"target":"ES2022","module":"nodenext","moduleResolution":"nodenext","strict":true,"paths":{"@lib/*":["./src/lib/*"]},"outDir":"dist","rootDir":"src"},"include":["src"]}`,
    "src/lib/message.cts": `export const message = "ok";` + "\n",
    "src/loader.ts": `declare function require(id: string): { message: string };
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
process.stdout.write(JSON.stringify([
  parameter.value((id) => id),
  local.value(),
  imported.value,
  loader.loaded,
]));
`)
  command := exec.Command("node", "runner.mjs")
  command.Dir = filepath.Join(root, "dist")
  output, err := command.CombinedOutput()
  if err != nil {
    t.Fatalf("emitted require cases did not run: %v\n%s", err, output)
  }
  if got, want := strings.TrimSpace(string(output)), `["@lib/message","local:@lib/message","imported:@lib/message","ok"]`; got != want {
    t.Fatalf("emitted require results mismatch: got %s, want %s", got, want)
  }
}
