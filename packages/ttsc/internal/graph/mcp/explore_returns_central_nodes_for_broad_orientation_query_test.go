package mcp_test

import (
  "path/filepath"
  "strings"
  "testing"

  "github.com/samchon/ttsc/packages/ttsc/driver"
  "github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreReturnsCentralNodesForBroadOrientationQuery verifies broad
// onboarding questions still get useful graph anchors when the user does not
// know project-specific symbol names yet.
//
// A natural new-developer prompt contains mostly generic words such as
// "orientation", "entry points", and "execution flow". If those words drive name
// matching, graph_explore either returns nothing or arbitrary symbols. The
// fallback should instead return central project nodes so the agent can answer
// from one graph snapshot.
//
//  1. Compile a small project where start() calls route(), which calls service().
//  2. Explore with the shared onboarding-style prompt.
//  3. Assert the central route() node is returned.
func TestExploreReturnsCentralNodesForBroadOrientationQuery(t *testing.T) {
  root := t.TempDir()
  writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/start.ts", "src/error.ts"]
}
`)
  writeFile(t, filepath.Join(root, "src", "error.ts"), `export class TypeORMError extends Error {
}
`)
  writeFile(t, filepath.Join(root, "src", "service.ts"), `export function service(): number {
  return 1;
}
`)
  writeFile(t, filepath.Join(root, "src", "route.ts"), `import { service } from "./service";
export function route(): number {
  return service();
}
`)
  writeFile(t, filepath.Join(root, "src", "start.ts"), `import { route } from "./route";
export function start(): number {
  return route();
}
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
  text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"I'm new to this TypeScript project and only have a few minutes. Give me a practical codebase orientation: the main subsystems, the best entry points to start reading, and one representative execution flow that shows how the pieces fit together."}}}`)

  if !strings.Contains(text, "function route") {
    t.Fatalf("graph_explore did not return central nodes for broad orientation query:\n%s", text)
  }

  text = toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"graph_explore","arguments":{"query":"entry point main benchmark TypeORM"}}}`)
  if !strings.Contains(text, "function route") {
    t.Fatalf("graph_explore matched package-name noise instead of central nodes:\n%s", text)
  }
}
