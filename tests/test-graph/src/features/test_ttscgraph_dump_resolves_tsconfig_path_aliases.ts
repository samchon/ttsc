import { TestProject } from "@ttsc/testing";

import { dumpGraph, findEdge, findNode } from "../internal/graphDump";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies graph dump resolves tsconfig path aliases through the checker.
 *
 * Path aliases are a TypeScript compiler concern, not a graph string-matching
 * concern. The graph must follow the symbol that the configured tsconfig binds,
 * so an alias import records edges to the real source declaration instead of to
 * the alias text.
 *
 * 1. Materialize a project with `baseUrl` and two `paths` aliases.
 * 2. Import a function and a type through those aliases.
 * 3. Assert the dump records call and type edges to the real source files.
 */
export const test_ttscgraph_dump_resolves_tsconfig_path_aliases = () => {
  const root = TestProject.createProject({
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2022",
        module: "commonjs",
        moduleResolution: "node",
        strict: true,
        baseUrl: ".",
        paths: {
          "@core/*": ["src/core/*"],
          "@models": ["src/models/index.ts"],
        },
      },
      include: ["src"],
    }),
    "src/core/helper.ts": [
      "export function helper(value: string): string {",
      "  return value.toUpperCase();",
      "}",
      "",
    ].join("\n"),
    "src/models/index.ts": [
      "export interface Payload {",
      "  value: string;",
      "}",
      "",
    ].join("\n"),
    "src/main.ts": [
      'import { helper } from "@core/helper";',
      'import type { Payload } from "@models";',
      "export function run(input: Payload): string {",
      "  return helper(input.value);",
      "}",
      "",
    ].join("\n"),
  });

  const dump = dumpGraph(root, "tsconfig.json");
  const run = findNode(dump, {
    file: "src/main.ts",
    name: "run",
    kind: "function",
  });
  const helper = findNode(dump, {
    file: "src/core/helper.ts",
    name: "helper",
    kind: "function",
  });
  const payload = findNode(dump, {
    file: "src/models/index.ts",
    name: "Payload",
    kind: "interface",
  });

  assert.ok(run, "caller imported through aliases is present");
  assert.ok(helper, "aliased function declaration is present");
  assert.ok(payload, "aliased type declaration is present");
  assert.ok(
    findEdge(dump, run, helper, "calls"),
    "alias function import resolves to a real call edge",
  );
  assert.ok(
    findEdge(dump, run, payload, "type_ref"),
    "alias type import resolves to a real type edge",
  );
};
