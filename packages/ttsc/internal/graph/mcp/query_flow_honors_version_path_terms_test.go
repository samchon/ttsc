package mcp_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestQueryFlowHonorsVersionPathTerms verifies version words constrain fuzzy
// flow discovery.
//
// Versioned packages often carry parallel `v3` and `v4` implementations with
// similar symbol names. A task that names the version should not be routed to an
// older folder merely because a symbol there has a strong name match.
//
//  1. Compile parallel v3 and v4 files with the same public function name.
//  2. Query a v4 parse flow using only task terms.
//  3. Assert the v4 implementation is returned and the v3 marker is absent.
func TestQueryFlowHonorsVersionPathTerms(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/v3/parse.ts", "src/v4/parse.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "v3", "parse.ts"), `
export function parseData(value: unknown): string {
  return collectIssues(value)
}

function collectIssues(value: unknown): string {
  return "V3_PARSE_MARKER:" + String(value)
}

export class ZodError {
  issues = "V3_ISSUES_MARKER"
}
`)
	writeFile(t, filepath.Join(root, "src", "v4", "parse.ts"), `
export function parseData(value: unknown): string {
  return runObjectShape(value)
}

function runObjectShape(value: unknown): string {
  return "V4_PARSE_MARKER:" + String(value)
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
	result := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_flow","arguments":{"query":"v4 parse data object shape issues ZodError"}}}`)
	if !strings.Contains(result, "V4_PARSE_MARKER") || !strings.Contains(result, "runObjectShape") {
		t.Fatalf("query_flow did not return the v4 parse flow:\n%s", result)
	}
	if strings.Contains(result, "V3_PARSE_MARKER") {
		t.Fatalf("query_flow returned v3 source for a v4 task:\n%s", result)
	}
	if strings.Contains(result, "V3_ISSUES_MARKER") {
		t.Fatalf("query_flow let a wrong-version exact dotted anchor dominate:\n%s", result)
	}
}
