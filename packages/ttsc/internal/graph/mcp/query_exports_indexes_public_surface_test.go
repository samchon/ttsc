package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestQueryExportsIndexesCompilerExports verifies query_exports uses the
// compiler's module export surface, including re-exports, while returning only
// compact coordinates and handles.
//
//  1. Compile a small module with local exports and a barrel re-export.
//  2. Query the exported surface.
//  3. Assert the result lists the public declarations with file, line, handle,
//     folder summary, and pagination text.
func TestQueryExportsIndexesCompilerExports(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/index.ts", "src/model.ts", "src/hidden.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "model.ts"), `export interface PublicModel {
  value: string
}

export class PublicService {
  status = "ready"

  run(model: PublicModel): string {
    return model.value
  }

  private secret(): string {
    return "hidden"
  }
}

class InternalOnly {}
`)
  writeFile(t, filepath.Join(root, "src", "hidden.ts"), `class PublicService {
  shadow(): string {
    return "not exported"
  }
}
`)
  writeFile(t, filepath.Join(root, "src", "index.ts"), `export { PublicService as Service } from "./model"
export type { PublicModel } from "./model"
export const localValue = 1
`)

  prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
  if err != nil {
    t.Fatal(err)
  }
  if len(diags) != 0 {
    t.Fatalf("unexpected diagnostics: %v", diags)
  }
  defer func() { _ = prog.Close() }()

  server := mcp.NewServer(prog)
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_exports","arguments":{}}}`)
  for _, want := range []string{
    "Export folders:",
    "class PublicService  exports:PublicService,Service",
    "method PublicService.run  exports:PublicService.run",
    "variable PublicService.status  exports:PublicService.status",
    "interface PublicModel",
    "variable localValue",
    "handle:",
    "calls:",
    "types:",
    "deps:",
    "Exports: showing",
  } {
    if !strings.Contains(text, want) {
      t.Fatalf("query_exports missing %q:\n%s", want, text)
    }
  }
  if strings.Contains(text, "InternalOnly") {
    t.Fatalf("query_exports included a non-exported declaration:\n%s", text)
  }
  if strings.Contains(text, "PublicService.secret") {
    t.Fatalf("query_exports included a private member:\n%s", text)
  }
  if strings.Contains(text, "PublicService.shadow") {
    t.Fatalf("query_exports included a member from a non-exported same-name owner:\n%s", text)
  }

  filtered := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_exports","arguments":{"query":"service","limit":1}}}`)
  if !strings.Contains(filtered, "class PublicService  exports:PublicService,Service") || strings.Contains(filtered, "PublicModel") {
    t.Fatalf("query_exports filter/limit did not narrow the result:\n%s", filtered)
  }
}

// TestQueryExportsOmitsGitIgnoredGeneratedCode pins the orientation rule that
// gitignored generated TypeScript is not part of the first project map.
func TestQueryExportsOmitsGitIgnoredGeneratedCode(t *testing.T) {
  root := t.TempDir()
  runGit(t, root, "init")
  writeFile(t, filepath.Join(root, ".gitignore"), "src/generated/\n")
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/app.ts", "src/generated/client.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "generated", "client.ts"), `export class GeneratedClient {}
`)
  writeFile(t, filepath.Join(root, "src", "app.ts"), `export class AppService {}
`)

  server := mcp.NewLazyServer(root, "tsconfig.json", driver.LoadProgramOptions{})
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_exports","arguments":{}}}`)
  if strings.Contains(text, "GeneratedClient") {
    t.Fatalf("query_exports included gitignored generated code:\n%s", text)
  }
  if !strings.Contains(text, "AppService") {
    t.Fatalf("query_exports omitted authored export:\n%s", text)
  }
}
