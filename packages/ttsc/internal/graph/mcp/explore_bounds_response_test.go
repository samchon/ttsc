package mcp_test

import (
	"fmt"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreBoundsResponse verifies query_nodes stays a bounded index: source
// bodies are omitted, dense edge lists report omitted counts, and broad matches
// still return compact graph records.
//
//  1. Compile a fixture with a 40-statement function, a Hub type referenced by 17
//     functions, and six large process* functions.
//  2. Build the server from the resident Program.
//  3. Assert each budget marker appears in the matching explore response.
func TestExploreBoundsResponse(t *testing.T) {
	root := t.TempDir()

	var src strings.Builder

	// (a) bigBody: a function whose body is 40 trivial statements. query_nodes
	// must return its coordinates, not its body.
	src.WriteString("export function bigBody(): void {\n")
	for i := 0; i < 40; i++ {
		fmt.Fprintf(&src, "  const a%d = 0;\n", i)
	}
	src.WriteString("}\n")

	// (b) Hub: an interface referenced as a parameter type by 17 functions, five
	// past the maxEdgesPerDirection (12) cap, so its incoming edges carry a "more"
	// tail.
	src.WriteString("export interface Hub {}\n")
	for i := 0; i < 17; i++ {
		fmt.Fprintf(&src, "export function u%d(h: Hub): void {}\n", i)
	}

	// (c) Six process* functions each with a large body. The broad query should
	// still return compact coordinates for all matches.
	for _, name := range []string{"processAlpha", "processBeta", "processGamma", "processDelta", "processEpsilon", "processZeta"} {
		fmt.Fprintf(&src, "export function %s(): number {\n", name)
		fmt.Fprintf(&src, "  let total%s: number = 0;\n", name)
		for i := 0; i < 40; i++ {
			fmt.Fprintf(&src, "  total%s = total%s + %d + 1 + 2 + 3 + 4 + 5 + 6 + 7 + 8 + 9 + 10 + 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20 + 21 + 22 + 23 + 24 + 25 + 26 + 27 + 28 + 29 + 30 + 31 + 32 + 33 + 34 + 35 + 36 + 37 + 38 + 39 + 40;\n", name, name, i)
		}
		fmt.Fprintf(&src, "  return total%s;\n", name)
		src.WriteString("}\n")
	}

	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "files": ["src/main.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "main.ts"), src.String())

	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected parse diagnostics: %v", diags)
	}
	defer func() { _ = prog.Close() }()
	server := mcp.NewServer(prog)

	// (a) query_nodes returns an index record, not the 40-line function body.
	big := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"bigBody"}}}`)
	if strings.Contains(big, "const a39") || strings.Contains(big, `"source"`) {
		t.Fatalf("query_nodes included source body instead of compact index data:\n%s", big)
	}

	// (b) A node with 17 incoming edges reports the five omitted records beyond
	// the 12-edge cap.
	hub := toolText(t, server, `{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"Hub"}}}`)
	if !strings.Contains(hub, `"omittedIncoming": 5`) {
		t.Fatalf("query_nodes did not count capped incoming edges:\n%s", hub)
	}

	// (c) Broad matches remain coordinate-only records.
	process := toolText(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"alpha beta gamma delta epsilon zeta"}}}`)
	if !strings.Contains(process, `"totalMatches": 6`) || strings.Contains(process, "totalprocessAlpha = totalprocessAlpha") {
		t.Fatalf("query_nodes did not return compact broad process matches:\n%s", process)
	}
}
