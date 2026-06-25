package mcp_test

import (
	"encoding/json"
	"path/filepath"
	"strings"
	"testing"

	"github.com/samchon/ttsc/packages/ttsc/driver"
	"github.com/samchon/ttsc/packages/ttsc/internal/graph/mcp"
)

// TestExploreExpandsExactCallPath verifies query_nodes expands a public method
// mention into its downstream value-call path.
//
// Agents often ask for one public method and then spend extra tool calls reading
// each callee body. The graph index should return the compiler-resolved path
// directly, without relying on project-specific words or helper-name filters.
//
//  1. Compile a fixture whose Gateway.fetch reaches Coordinator.fetch and then
//     Pipeline.setPlan/applyPlan/buildSteps/Worker.execute.
//  2. Ask both a natural question and a concise owner/member query.
//  3. Assert the downstream path bodies appear in the same query_nodes result.
func TestExploreExpandsExactCallPath(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "main.ts"), `
export class Gateway {
  constructor(private readonly coordinator: Coordinator) {}

  fetch(request: RequestPlan): string[] {
    return this.coordinator.fetch(request);
  }

  fetchAndCount(request: RequestPlan): [string[], number] {
    return [this.coordinator.fetch(request), 0];
  }
}

export class Coordinator {
  fetch(request: RequestPlan): string[] {
    return this.createPipeline()
      .setPlan(request.plan)
      .map((step) => new Worker(step).execute());
  }

  createPipeline(): Pipeline {
    return new Pipeline();
  }
}

export class Pipeline {
  private plan: Plan = { steps: [] };

  setPlan(plan: Plan): string[] {
    this.plan = plan;
    return this.applyPlan();
  }

  applyPlan(): string[] {
    this.plan = normalizePlan(this.plan);
    return this.buildSteps();
  }

  buildSteps(): string[] {
    return this.plan.steps.map((step) => step.name);
  }
}

export class Worker {
  constructor(private readonly step: string) {}

  execute(): string {
    return this.step.toUpperCase();
  }
}

export function normalizePlan(plan: Plan): Plan {
  return { steps: plan.steps.filter((step) => step.enabled) };
}

export interface RequestPlan {
  plan: Plan;
}

export interface Plan {
  steps: Array<{ name: string; enabled: boolean }>;
}
`)

	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected parse diagnostics: %v", diags)
	}
	defer func() { _ = prog.Close() }()

	server := mcp.NewServer(prog)
	path := toolStructured(t, server, `{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"query_path","arguments":{"from":"Gateway.fetch","via":["Coordinator.fetch","Pipeline.setPlan","applyPlan"],"to":"buildSteps"}}}`)
	pathNodes, ok := path["nodes"].([]any)
	if !ok || len(pathNodes) < 5 {
		t.Fatalf("query_path returned too few nodes: %v", path)
	}
	pathText, err := json.Marshal(pathNodes)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"Gateway.fetch",
		"Coordinator.fetch",
		"Pipeline.setPlan",
		"Pipeline.applyPlan",
		"Pipeline.buildSteps",
	} {
		if !strings.Contains(string(pathText), want) {
			t.Fatalf("query_path did not include %s in the ordered path:\n%s", want, pathText)
		}
	}
	firstPathNode, ok := pathNodes[0].(map[string]any)
	if !ok {
		t.Fatalf("query_path node is not an object: %v", pathNodes[0])
	}
	for _, required := range []string{"handle", "kind", "name", "file", "line"} {
		if _, ok := firstPathNode[required]; !ok {
			t.Fatalf("query_path node missing %s: %v", required, firstPathNode)
		}
	}
	for _, forbidden := range []string{"external", "edges", "diagnostics", "blastRadius", "source"} {
		if _, ok := firstPathNode[forbidden]; ok {
			t.Fatalf("query_path node leaked %s: %v", forbidden, firstPathNode)
		}
	}
	pathEdges, ok := path["edges"].([]any)
	if !ok || len(pathEdges) == 0 {
		t.Fatalf("query_path returned no edges: %v", path)
	}
	firstPathEdge, ok := pathEdges[0].(map[string]any)
	if !ok {
		t.Fatalf("query_path edge is not an object: %v", pathEdges[0])
	}
	for _, required := range []string{"fromHandle", "toHandle", "kind"} {
		if _, ok := firstPathEdge[required]; !ok {
			t.Fatalf("query_path edge missing %s: %v", required, firstPathEdge)
		}
	}
	for _, forbidden := range []string{"from", "to", "onPath"} {
		if _, ok := firstPathEdge[forbidden]; ok {
			t.Fatalf("query_path edge repeated %s instead of compact handles: %v", forbidden, firstPathEdge)
		}
	}

	// query_path also lists the off-path helpers each path node calls, with handles,
	// so the caller can expand the whole neighborhood in one batch instead of running a
	// separate discovery query to find a helper's handle. applyPlan calls normalizePlan
	// off the path, so it must appear as a callee tagged with its calling node.
	pathCallees, ok := path["callees"].([]any)
	if !ok || len(pathCallees) == 0 {
		t.Fatalf("query_path returned no callees: %v", path)
	}
	calleeText, err := json.Marshal(pathCallees)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(calleeText), "normalizePlan") {
		t.Fatalf("query_path callees did not include the off-path helper normalizePlan:\n%s", calleeText)
	}
	firstCallee, ok := pathCallees[0].(map[string]any)
	if !ok {
		t.Fatalf("query_path callee is not an object: %v", pathCallees[0])
	}
	for _, required := range []string{"fromHandle", "handle", "kind", "name", "file", "line"} {
		if _, ok := firstCallee[required]; !ok {
			t.Fatalf("query_path callee missing %s: %v", required, firstCallee)
		}
	}

	// query_path with only the two endpoints stitches the full ordered chain, so a
	// caller that knows just the public entry and the terminal symbol still gets
	// the path the compiler resolves between them, without naming the intermediates.
	autoPath := toolStructured(t, server, `{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"query_path","arguments":{"from":"Gateway.fetch","to":"buildSteps"}}}`)
	autoNodes, ok := autoPath["nodes"].([]any)
	if !ok || len(autoNodes) < 5 {
		t.Fatalf("query_path without via did not stitch the chain: %v", autoPath)
	}
	autoText, err := json.Marshal(autoNodes)
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"Gateway.fetch",
		"Coordinator.fetch",
		"Pipeline.setPlan",
		"Pipeline.applyPlan",
		"Pipeline.buildSteps",
	} {
		if !strings.Contains(string(autoText), want) {
			t.Fatalf("query_path without via missing %s in the stitched path:\n%s", want, autoText)
		}
	}

	// An anchor that matches no graph node is reported, not silently dropped, so the
	// caller learns the symbol was wrong instead of misreading an empty result as
	// "no such relationship". This is the negative twin of a resolved anchor.
	missingPath := toolStructured(t, server, `{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"query_path","arguments":{"from":"Gateway.fetch","to":"noSuchSymbolHere"}}}`)
	if nodes, _ := missingPath["nodes"].([]any); len(nodes) != 0 {
		t.Fatalf("query_path resolved an impossible anchor: %v", missingPath)
	}
	if msg, _ := missingPath["message"].(string); !strings.Contains(msg, "did not resolve") {
		t.Fatalf("query_path did not report the unresolved anchor: %v", missingPath["message"])
	}

	// Two real anchors with no forward value-flow between them return an explicit
	// no-path message rather than a fabricated route. The reverse direction of the
	// real chain is the negative twin of the stitched path above.
	noPath := toolStructured(t, server, `{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"query_path","arguments":{"from":"buildSteps","to":"Gateway.fetch"}}}`)
	if nodes, _ := noPath["nodes"].([]any); len(nodes) != 0 {
		t.Fatalf("query_path invented a reverse path: %v", noPath)
	}
	if msg, _ := noPath["message"].(string); !strings.Contains(msg, "No runtime value-flow path") {
		t.Fatalf("query_path did not report the missing path: %v", noPath["message"])
	}
}

func TestExploreFollowsRelevantValueConsumers(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "tsconfig.json"), `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "strict": true
  },
  "files": ["src/main.ts"]
}
`)
	writeFile(t, filepath.Join(root, "src", "main.ts"), `
export class StateBag {
  records: string[] = [];
}

export class Builder {
  private state = new StateBag();

  record(value: string): void {
    this.state.records.push(value);
  }

  createSummary(): string {
    return this.state.records.join(" ");
  }
}
`)

	prog, diags, err := driver.LoadProgram(root, "tsconfig.json", driver.LoadProgramOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if len(diags) != 0 {
		t.Fatalf("unexpected parse diagnostics: %v", diags)
	}
	defer func() { _ = prog.Close() }()

	server := mcp.NewServer(prog)
	text := toolText(t, server, `{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":"Builder StateBag.records summary records","mode":"flow"}}}`)
	for _, want := range []string{
		"StateBag.records",
		"Builder.createSummary",
	} {
		if !strings.Contains(text, want) {
			t.Fatalf("query_nodes did not include %s in the reverse consumer flow:\n%s", want, text)
		}
	}
}
