package mcp_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestQueryFlowDiscoversTaskPathWithoutExactAnchors verifies natural-language
// flow discovery returns the ordered implementation slice.
//
// Agents often start with domain words rather than exact declaration handles.
// The task-level flow tool must therefore choose seed declarations, follow
// runtime value edges, and return the relevant source in one bounded response
// instead of forcing a chain of broad fuzzy queries.
//
//  1. Compile a canvas-rendering pipeline with an entry, renderer, element
//     renderer, and shape-cache helper.
//  2. Call query_flow with only task/domain words.
//  3. Assert the returned structured text includes the relevant pipeline and
//     excludes an unrelated helper.
func TestQueryFlowDiscoversTaskPathWithoutExactAnchors(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts", "src/main.test.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "main.ts"), `
export function updateCanvasElements(elements: string[]): string[] {
  const visible = getRenderableElements(elements)
  return renderStaticScene(visible)
}

function getRenderableElements(elements: string[]): string[] {
  return elements.filter((element) => element.length > 0)
}

function renderStaticScene(elements: string[]): string[] {
  return elements.map((element) => renderElement(element))
}

function renderElement(element: string): string {
  return ShapeCache.generateElementShape(element)
}

class ShapeCache {
  static generateElementShape(element: string): string {
    return "SHAPE_CACHE_MARKER:" + element
  }
}

function hydrateNetworkCache(): string {
  return "UNRELATED_NETWORK_MARKER"
}
`)
	writeFile(t, filepath.Join(root, "src", "main.test.ts"), `
export function renderStaticScene(): string {
  return "TEST_RENDER_MARKER"
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
	result := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_flow","arguments":{"query":"canvas update render elements shape cache"}}}`)
	for _, want := range []string{"updateCanvasElements", "renderStaticScene", "renderElement", "generateElementShape", "SHAPE_CACHE_MARKER"} {
		if !strings.Contains(result, want) {
			t.Fatalf("query_flow result missed %q:\n%s", want, result)
		}
	}
	if strings.Contains(result, "UNRELATED_NETWORK_MARKER") {
		t.Fatalf("query_flow included unrelated helper source:\n%s", result)
	}
	if strings.Contains(result, "TEST_RENDER_MARKER") {
		t.Fatalf("query_flow included test helper source for a non-test task:\n%s", result)
	}
}
