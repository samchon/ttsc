import { TestProject } from "@ttsc/testing";

import {
  assert,
  resolveGraphLauncher,
  resolveTtscgraphBinary,
} from "../internal/ttsgraph";

interface InspectOutput {
  audit: string;
  next: { action: string };
  result: { type: string; [key: string]: unknown };
}

/**
 * Verifies the command-line projection calls the same semantic graph branches
 * the MCP server exposes, rather than making callers reconstruct a request
 * envelope or consume the native protocol directly.
 *
 * 1. Materialize a small call chain and run every graph-reading request through
 *    `ttsc-graph inspect`.
 * 2. Assert the compiler-resolved output keeps the MCP envelope and each branch
 *    returns facts for the supplied project.
 * 3. Leave `escape` MCP-only: it deliberately performs no graph work and has no
 *    shell inspection equivalent.
 */
export const test_ttscgraph_inspect_cli_exposes_semantic_requests = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "commonjs",
          strict: true,
          rootDir: "src",
          outDir: "dist",
        },
        include: ["src"],
      },
      null,
      2,
    ),
    "src/app.ts": [
      "export function helper(): void {}",
      "",
      "export class Service {",
      "  run(): void {",
      "    helper();",
      "  }",
      "}",
      "",
      "export function start(): void {",
      "  new Service().run();",
      "}",
      "",
    ].join("\n"),
    "src/app.test.ts": [
      "import { Service } from './app';",
      "",
      "export function coversRun(): void {",
      "  new Service().run();",
      "}",
      "",
    ].join("\n"),
  });
  const run = (args: readonly string[]): InspectOutput => {
    const result = TestProject.spawn(
      process.execPath,
      [resolveGraphLauncher(), "inspect", ...args],
      {
        cwd: root,
        env: { ...process.env, TTSC_GRAPH_BINARY: resolveTtscgraphBinary() },
        timeout: 120_000,
      },
    );
    assert.equal(
      result.status,
      0,
      `ttsc-graph inspect ${args.join(" ")} failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
    );
    return JSON.parse(result.stdout) as InspectOutput;
  };
  const assertResult = (output: InspectOutput, type: string): void => {
    assert.equal(output.result.type, type, `result: ${JSON.stringify(output)}`);
    assert.equal(typeof output.audit, "string", "the MCP audit is preserved");
    assert.equal(
      typeof output.next.action,
      "string",
      "the MCP next is preserved",
    );
  };

  const overview = run(["overview", "--cwd", root, "--aspect", "publicApi"]);
  assertResult(overview, "overview");
  assert.ok(
    Array.isArray(overview.result.publicApi),
    `overview includes the requested public API facet: ${JSON.stringify(overview.result)}`,
  );

  const inlineOverview = run([
    "overview",
    `--cwd=${root}`,
    "--aspect=publicApi",
  ]);
  assertResult(inlineOverview, "overview");
  assert.ok(
    Array.isArray(inlineOverview.result.publicApi),
    `inline option values reach overview: ${JSON.stringify(inlineOverview.result)}`,
  );

  const entrypoints = run([
    "entrypoints",
    "How does Service.run reach helper?",
    "--cwd",
    root,
    "--neighbors",
    "1",
  ]);
  assertResult(entrypoints, "entrypoints");
  assert.ok(
    (entrypoints.result.hits as Array<{ name?: string }>).some(
      (hit) => hit.name === "Service.run",
    ),
    `entrypoints resolves the question's handle: ${JSON.stringify(entrypoints.result)}`,
  );

  const lookup = run(["lookup", "Service", "--cwd", root, "--limit", "1"]);
  assertResult(lookup, "lookup");
  assert.ok(
    (lookup.result.hits as Array<{ name?: string }>).some(
      (hit) => hit.name === "Service",
    ),
    `lookup resolves a concrete symbol: ${JSON.stringify(lookup.result)}`,
  );

  const escapedLookup = run([
    "lookup",
    "--cwd",
    root,
    "--",
    "--literal-handle",
  ]);
  assertResult(escapedLookup, "lookup");

  const externalLookup = run([
    "lookup",
    "Service",
    "--cwd",
    root,
    "--include-external",
  ]);
  assertResult(externalLookup, "lookup");

  const details = run([
    "details",
    "Service.run",
    "--cwd",
    root,
    "--neighbors",
    "--neighbor-limit",
    "1",
  ]);
  assertResult(details, "details");
  assert.ok(
    (details.result.nodes as Array<{ name?: string }>).some(
      (node) => node.name === "Service.run",
    ),
    `details resolves the requested handle: ${JSON.stringify(details.result)}`,
  );

  const multipleDetails = run([
    "details",
    "Service.run",
    "helper",
    "--cwd",
    root,
  ]);
  assertResult(multipleDetails, "details");
  const detailNames = (multipleDetails.result.nodes as Array<{ name?: string }>)
    .map((node) => node.name);
  assert.ok(
    detailNames.includes("Service.run") && detailNames.includes("helper"),
    `details preserves every supplied handle: ${JSON.stringify(multipleDetails.result)}`,
  );

  const trace = run([
    "trace",
    "Service.run",
    "--to",
    "helper",
    "--cwd",
    root,
    "--focus",
    "execution",
  ]);
  assertResult(trace, "trace");
  assert.ok(
    (trace.result.path as Array<{ name?: string }>).some(
      (node) => node.name === "helper",
    ),
    `trace follows the requested path: ${JSON.stringify(trace.result)}`,
  );

  const tour = run([
    "tour",
    "How does Service.run reach helper?",
    "--cwd",
    root,
    "--hint",
    "Service.run",
    "--hint",
    "helper",
    "--no-tests",
  ]);
  assertResult(tour, "tour");
  assert.ok(
    (tour.result.entrypoints as Array<{ name?: string }>).some(
      (node) => node.name === "Service.run",
    ),
    `tour uses repeated symbol hints: ${JSON.stringify(tour.result)}`,
  );
};
