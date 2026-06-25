package mcp_test

import (
  "fmt"
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
      .applyPlan()
      .buildSteps()
      .map((step) => new Worker(step).execute());
  }

  createPipeline(): Pipeline {
    return new Pipeline();
  }
}

export class Pipeline {
  private plan: Plan = { steps: [] };

  setPlan(plan: Plan): this {
    this.plan = plan;
    return this;
  }

  applyPlan(): this {
    this.plan = normalizePlan(this.plan);
    return this;
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
  cases := []string{
    "How does Gateway.fetch pass a requested plan into pipeline steps? Trace the call path from the public fetch method to where steps are built and execute.",
    "Gateway fetch Coordinator fetch Pipeline setPlan applyPlan buildSteps Worker execute plan steps",
  }
  for _, query := range cases {
    text := toolText(t, server, fmt.Sprintf(`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"query_nodes","arguments":{"query":%q}}}`, query))
    for _, want := range []string{
      "method Gateway.fetch",
      "method Coordinator.fetch",
      "method Pipeline.setPlan",
      "method Pipeline.applyPlan",
      "method Pipeline.buildSteps",
      "method Worker.execute",
    } {
      if !strings.Contains(text, want) {
        t.Fatalf("query_nodes did not include %s for query %q in the expanded path:\n%s", want, query, text)
      }
    }
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
    "variable StateBag.records",
    "method Builder.createSummary",
  } {
    if !strings.Contains(text, want) {
      t.Fatalf("query_nodes did not include %s in the reverse consumer flow:\n%s", want, text)
    }
  }
}
