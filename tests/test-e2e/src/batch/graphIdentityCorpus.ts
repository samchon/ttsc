import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Client = {
  request(method: string, params: unknown): Promise<unknown>;
  assertInputMutationAllowed(): void;
  preventInputReuse(reason: string): void;
};
type Reference = { name: string; file: string; relation: string };
type Details = { name: string; file: string; calls?: Reference[]; types?: Reference[]; dependsOn?: Reference[] };

/** Stage the native link and aliases before the shared graph session starts. */
export function prepareGraphIdentityCorpus(root: string): () => void {
  const configFile = path.join(root, "tsconfig.json");
  const original = fs.readFileSync(configFile);
  const config = JSON.parse(original.toString("utf8"));
  config.compilerOptions.rootDir = ".";
  Object.assign(config.compilerOptions.paths, {
    "@graph-preservation/*": ["./src/graph-alias/*"],
    "@graph-preservation-exact": ["./src/graph-alias/models.ts"],
  });
  const link = path.join(root, "node_modules/@scope/graph-preservation-shared");
  fs.mkdirSync(path.dirname(link), { recursive: true });
  assert.equal(fs.existsSync(link), false);
  fs.symlinkSync(path.join(root, "tools/graph-workspace/shared"), link, "junction");
  fs.writeFileSync(configFile, JSON.stringify(config));
  return () => {
    fs.unlinkSync(link);
    fs.writeFileSync(configFile, original);
  };
}

/**
 * Preserve actual native package identity and alias resolution in one session.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual MCP native details carry linked physical sibling function/interface/class declarations and calls/type_ref/extends relations, plus wildcard function and exact interface aliases. Parking the real package link removes its declarations without losing the app; restoring it restores the same physical relationships.
 * @evidence contracts/testing.md#independent-expectations Authored declaration names, literal physical source paths and relation kinds establish expected identity. Default external exclusion must still deliver the linked source, and no returned declaration or relation may use its node_modules alias spelling.
 * @evidence contracts/testing.md#distinguishing-cases Linked package versus unresolved package, physical versus logical module paths, wildcard versus exact alias and call/type/heritage edges are independent controls.
 * @evidence contracts/testing.md#execution-ownership The existing selected Graph client owns every request. No CLI, new host, Program API or observer is introduced; link membership changes cause real native snapshot replacement work in that same session.
 * @evidence contracts/e2e.md#necessary-boundary The actual compiler resolver and kernel link must preserve native identity and tolerate an unresolved package; synthetic graph and path units cannot prove this connection.
 * @evidence contracts/e2e.md#shared-execution All source/config/package declarations are staged before the first native snapshot. Readonly linked/alias facts share it; unresolved/restored epochs retain necessary native refresh costs rather than separate project preparation.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Only this namespace's real link is parked, after mutation authority. Restoration is mandatory and failures withdraw reuse. The selected caller restores its original compiler config only after actual client/native close; no uncertain reader authorizes input cleanup.
 * @evidence contracts/e2e.md#preserved-coverage Restores native pnpm-shaped physical link, alias call/type edge and unresolved membership meanings. The default public external filter preserves local-source eligibility; no raw external boolean or actual pnpm installation is fabricated.
 */
export async function assertGraphIdentityCorpus(client: Client, root: string): Promise<void> {
  const details = async (handles: string[]): Promise<Details[]> => {
    const response = await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question: "What native declarations and relationships do these physical imports resolve?",
        draft: { reason: "Details retain exact native edges and physical files.", type: "details" },
        review: "Use actual linked source identity with external nodes excluded.",
        request: { type: "details", handles, neighbors: true, includeExternal: false },
      },
    }) as { isError?: boolean; structuredContent?: { result?: { type?: string; nodes?: Details[] } } };
    assert.equal(response.isError, undefined, JSON.stringify(response));
    assert.equal(response.structuredContent?.result?.type, "details");
    return response.structuredContent!.result!.nodes!;
  };
  const failures: unknown[] = [];
  const capture = async (name: string, operation: () => Promise<void>): Promise<void> => {
    try { await operation(); } catch (error) { failures.push(new Error(name, { cause: error })); }
  };
  const handles = ["graphWorkspaceRun", "GraphWorkspaceApp", "graphWorkspaceHelper", "GraphWorkspaceInput", "GraphWorkspaceService", "graphAliasRun", "graphAliasHelper", "GraphAliasPayload"];
  const linked = async (): Promise<void> => {
    const nodes = await details(handles);
    const node = (name: string): Details => {
      const value = nodes.find((entry) => entry.name === name);
      assert.ok(value, "native local declaration " + name);
      return value;
    };
    for (const name of ["graphWorkspaceHelper", "GraphWorkspaceInput", "GraphWorkspaceService"])
      assert.equal(node(name).file, "tools/graph-workspace/shared/index.ts");
    for (const name of ["graphWorkspaceHelper", "GraphWorkspaceInput", "GraphWorkspaceService"]) {
      const lookup = await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: {
          question: "Is this linked source eligible when external declarations are excluded?",
          draft: { reason: "Lookup applies the public external exclusion filter.", type: "lookup" },
          review: "Preserve local workspace ownership, not an external library alias.",
          request: { type: "lookup", query: name, includeExternal: false },
        },
      }) as { isError?: boolean; structuredContent?: { result?: { type?: string; hits?: { name: string; file: string }[] } } };
      assert.equal(lookup.isError, undefined, JSON.stringify(lookup));
      assert.equal(lookup.structuredContent?.result?.type, "lookup");
      assert.ok(lookup.structuredContent!.result!.hits?.some((hit) => hit.name === name && hit.file === "tools/graph-workspace/shared/index.ts"), name + " must be actual nonexternal source");
    }
    const edge = (from: string, to: string, relation: string): void => {
      const source = node(from);
      assert.ok([...(source.calls ?? []), ...(source.types ?? []), ...(source.dependsOn ?? [])].some((reference) => reference.name === to && reference.relation === relation), from + " " + relation + " " + to);
    };
    edge("graphWorkspaceRun", "graphWorkspaceHelper", "calls");
    edge("graphWorkspaceRun", "GraphWorkspaceInput", "type_ref");
    edge("GraphWorkspaceApp", "GraphWorkspaceService", "extends");
    edge("graphAliasRun", "graphAliasHelper", "calls");
    edge("graphAliasRun", "GraphAliasPayload", "type_ref");
    for (const value of nodes) {
      assert.equal(value.file.includes("node_modules"), false, value.file);
      for (const reference of [...(value.calls ?? []), ...(value.types ?? []), ...(value.dependsOn ?? [])])
        assert.equal(reference.file.includes("node_modules/@scope/graph-preservation-shared"), false, reference.file);
    }
  };
  await capture("native linked and alias identity", linked);
  const link = path.join(root, "node_modules/@scope/graph-preservation-shared");
  const parked = path.join(root, "tools/graph-workspace/parked-link");
  await capture("native unresolved and restored package membership", async () => {
    assert.equal(fs.existsSync(parked), false);
    client.assertInputMutationAllowed();
    fs.renameSync(link, parked);
    try {
      const nodes = await details(["graphWorkspaceRun", "graphWorkspaceHelper", "GraphWorkspaceInput", "GraphWorkspaceService"]);
      assert.ok(nodes.some((node) => node.name === "graphWorkspaceRun"));
      assert.equal(nodes.some((node) => node.file.startsWith("tools/graph-workspace/shared/")), false);
      assert.equal(nodes.some((node) => node.file.includes("node_modules")), false);
    } finally {
      try { client.assertInputMutationAllowed(); fs.renameSync(parked, link); }
      catch (error) { client.preventInputReuse("native graph workspace link restoration failed"); throw error; }
    }
    await linked();
  });
  if (failures.length) throw new AggregateError(failures, "native graph package identity corpus failed");
}
