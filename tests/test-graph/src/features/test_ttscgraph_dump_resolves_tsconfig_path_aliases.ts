import { findEdge, findNode } from "../internal/graphDump";
import { getIdentityDump } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

/**
 * Verifies graph dump resolves tsconfig path aliases through the checker.
 *
 * Path aliases are a TypeScript compiler concern, not a graph string-matching
 * concern. The graph must follow the symbol that the configured tsconfig binds,
 * so an alias import records edges to the real source declaration instead of to
 * the alias text.
 *
 * 1. Materialize a project with exact and wildcard `paths` aliases.
 * 2. Import a function and a type through those aliases.
 * 3. Assert the dump records call and type edges to the real source files.
 *
 * @evidence contracts/testing.md#behavioral-verification Real dump resolves wildcard function and exact type aliases from tsconfig paths and emits the three expected declarations with call and type-reference edges.
 * @evidence contracts/testing.md#independent-expectations Literal authored import targets, project-relative paths entries and expected relation kinds define resolution independently of the returned dump.
 * @evidence contracts/testing.md#distinguishing-cases Wildcard and exact mapping forms both lead to real definitions; this case does not own unresolved-workspace behavior, which the adjacent unresolved case checks.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_dump_resolves_tsconfig_path_aliases runs the actual native dump producer on its fixture project; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary Compiler project config loading, alias resolution and checker edge publication must connect in actual dump output; a direct paths matcher cannot prove the imported symbols resolve.
 * @evidence contracts/e2e.md#shared-execution Twenty-eight native graph entries share one project: twenty-five borrow an initialized MCP/native session, and four immutable producer assertions borrow one cached public CLI dump (the checker case uses both). Raw-only selections prepare no MCP client. Closed MCP/tag source scopes preserve original ranking/query universes; named edits advance actual generations.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Disjoint files, contracts, chains and citation targets preserve distinctions; spec/test roles, decorators, exact/wildcard aliases, real external declarations and a physical workspace link remain. MCP/tag scopes and invalid-config recovery restore config bytes finally. The cached CLI dump serves only unchanged producer assertions; serial MCP requests synchronize named edits, and suite finally joins its owned client after full collection.
 * @evidence contracts/e2e.md#preserved-coverage Original three-node and call/type_ref edge assertions remain; no resolver-only predicate is presented as equivalent producer coverage.
 */
export const test_ttscgraph_dump_resolves_tsconfig_path_aliases = async () => {
  const dump = await getIdentityDump();
  const run = findNode(dump, {
    file: "src/alias-main.ts",
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
