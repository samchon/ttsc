import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Client = {
  request(method: string, params: unknown): Promise<unknown>;
  assertInputMutationAllowed(): void;
  preventInputReuse(reason: string): void;
};
interface Member {
  name: string;
  kind: string;
  line?: number;
  signature?: string;
}
interface ToolResult {
  structuredContent?: unknown;
}
const detailsArguments = (handle: string) => ({
  question: `What direct members does ${handle} declare?`,
  draft: {
    reason: "One details request reads actual native identities.",
    type: "details",
  },
  review: "Keep the requested direct native declarations.",
  request: { type: "details", handles: [handle] },
});
const membersOf = (result: ToolResult, name: string): Member[] => {
  const value = (result.structuredContent ?? {}) as {
    result?: { type?: string; nodes?: { name?: string; members?: Member[] }[] };
  };
  assert.equal(value.result?.type, "details", JSON.stringify(value));
  return value.result?.nodes?.find((node) => node.name === name)?.members ?? [];
};
/**
 * Verifies native object identities, complete traces and outline replacement
 * through the existing graph host.
 *
 * 1. Trace static object members through actual MCP in both directions and
 *    distinguish dotted literal keys from nested objects.
 * 2. Request all sixty direct callers and a twenty-hop chain from the same native
 *    generation, including impact export roles.
 * 3. Retain the direct member outline/body exclusions, then edit and restore that
 *    object's source through the resident session.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual MCP trace replies resolve object methods and callable properties to their native callers/helper, retain distinct literal/nested keys and source spans, return all sixty reverse/impact callers and twenty chain nodes without truncation, and preserve the original sixteen-member outline/replacement assertions.
 * @evidence contracts/testing.md#independent-expectations Authored source declares sixty distinctly named callers and a twenty-edge chain; literal names and roles prescribe expected trace results independently of traversal. Sixteen direct keys and eight body markers retain the independent outline oracle.
 * @evidence contracts/testing.md#distinguishing-cases Object shorthand/static/dynamic/spread/nested/accessor/callable distinctions coexist; alias calls, bracketed-versus-nested identity, above-default reverse/impact fanout and deep complete forward traversal add native connection contrasts. The controlled outline edit still distinguishes refresh from stale identity.
 * @evidence contracts/testing.md#execution-ownership Called once by the selected graph entry with its already initialized client. It creates no launcher, compiler profile or project and invokes no legacy scene.
 * @evidence contracts/e2e.md#necessary-boundary Actual checker-produced object endpoints and large/deep graph facts must survive the generated MCP request schema and trace serialization. Source units own traversal policies; this case authenticates their connection to a real producer and transport alongside the existing refreshed outline.
 * @evidence contracts/e2e.md#shared-execution Object, caller and chain populations are staged before the first native snapshot and share its existing client/Program. Independent trace scenarios collect failures before the outline mutation; one deliberate object edit/restore advances the same session without separate hosts.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The edit captures original bytes and requires actual client's mutation authority before edit/restore. Restoration failure withdraws reuse; the calling graph entry joins the actual host close.
 * @evidence contracts/e2e.md#preserved-coverage Every original object outline and replacement assertion is retained. MCP branch meanings are owned separately by graphMcpCorpus; ranked tour/global-universe, CLI extraction and encoding/other refresh originals are not certified here.
 */
export async function assertGraphNativeShapeCorpus(
  client: Client,
  root: string,
): Promise<void> {
  const failures: unknown[] = [];
  const run = async (name: string, operation: () => Promise<void>) => {
    try {
      await operation();
    } catch (cause) {
      failures.push(new Error(name, { cause }));
    }
  };
  const trace = async (request: Record<string, unknown>) => {
    const reply = (await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question: "Which native declarations does this API reach?",
        draft: { type: "trace", reason: "Trace actual checker relationships." },
        review: "Use the returned declaration identities and relationships.",
        request: { type: "trace", focus: "execution", ...request },
      },
    })) as {
      structuredContent?: {
        result?: {
          type: string;
          start?: { id: string; name: string; sourceSpan?: unknown };
          reached: { name: string; roles?: string[] }[];
          truncated: boolean;
        };
      };
    };
    const result = reply.structuredContent?.result;
    assert.equal(result?.type, "trace", JSON.stringify(reply));
    return result!;
  };
  await run("native-object-method-call-identity", async () => {
    for (const from of [
      "objectApi.create",
      "objectApi.arrow",
      "objectApi.nested.key",
      'objectApi["nested.key"]',
      'objectApi["a[\\\"\\\"]"]',
      'objectApi.a[""]',
    ]) {
      const reverse = await trace({
        from,
        direction: "reverse",
        complete: true,
      });
      assert.equal(reverse.start?.name, from);
      assert.ok(reverse.start?.sourceSpan, JSON.stringify(reverse));
      assert.ok(
        reverse.reached.some((node) => node.name === "GraphObjectCaller"),
        JSON.stringify(reverse),
      );
      const forward = await trace({ from, complete: true });
      assert.ok(
        forward.reached.some((node) => node.name === "GraphObjectHelper"),
        JSON.stringify(forward),
      );
    }
  });
  for (const direction of ["reverse", "impact"]) {
    await run(`native-complete-fanout-${direction}`, async () => {
      const result = await trace({
        from: "GraphFanoutRoot",
        direction,
        complete: true,
      });
      assert.equal(result.truncated, false);
      assert.deepEqual(
        new Set(result.reached.map((node) => node.name)),
        new Set(
          Array.from({ length: 60 }, (_, index) => `GraphFanoutCaller${index}`),
        ),
      );
      if (direction === "impact")
        assert.ok(
          result.reached.every((node) => node.roles?.includes("exported")),
        );
    });
  }
  await run("native-complete-depth", async () => {
    const result = await trace({ from: "GraphDepth0", complete: true });
    assert.equal(result.truncated, false);
    assert.deepEqual(
      result.reached.map((node) => node.name),
      Array.from({ length: 20 }, (_, index) => `GraphDepth${index + 1}`),
    );
  });
  await run("native-object-outline-and-refresh", async () => {
    const original = membersOf(
      (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: detailsArguments("shape"),
      })) as ToolResult,
      "shape",
    );
    assert.deepEqual(
      original.map((member) => [member.name, member.kind]),
      [
        ["real", "property"],
        ["close", "property"],
        ["text", "property"],
        ["shorthand", "property"],
        ["static-key", "property"],
        ["", "property"],
        ["1", "property"],
        ["method", "method"],
        ["value", "method"],
        ["value", "method"],
        ["run", "property"],
        ["classic", "property"],
        ["klass", "property"],
        ["list", "property"],
        ["nested", "property"],
        ["afterSpread", "property"],
      ],
    );
    assert.ok(
      original.every(
        (member) =>
          member.name !== "inner" &&
          member.name !== "fromSpread" &&
          member.name !== "dynamic",
      ),
      JSON.stringify(original),
    );
    assert.equal(original[0]?.line, 7);
    assert.equal(original[0]?.signature, "real: 1");
    assert.equal(original.at(-1)?.signature, "afterSpread: true");
    const signatures = new Map(
      original.map((member) => [member.name, member.signature]),
    );
    assert.equal(signatures.get("method"), "method() {");
    assert.equal(signatures.get("run"), "run: () =>");
    assert.equal(signatures.get("classic"), "classic: function () {");
    assert.equal(signatures.get("klass"), "klass: class");
    assert.equal(signatures.get("list"), "list: [");
    assert.equal(signatures.get("nested"), "nested: {");
    for (const forbidden of [
      "METHOD_BODY_MUST_NOT_APPEAR",
      "ACCESSOR_BODY_MUST_NOT_APPEAR",
      "SETTER_BODY_MUST_NOT_APPEAR",
      "ARROW_BODY_MUST_NOT_APPEAR",
      "FUNCTION_BODY_MUST_NOT_APPEAR",
      "CLASS_BODY_MUST_NOT_APPEAR",
      "ARRAY_CONTENT_MUST_NOT_APPEAR",
      "NESTED_BODY_MUST_NOT_APPEAR",
    ])
      assert.ok(
        original.every(
          (member) => member.signature?.includes(forbidden) !== true,
        ),
        `${forbidden}: ${JSON.stringify(original)}`,
      );

    const sourceFile = path.join(root, "src", "object-outline.ts");
    const originalSource = fs.readFileSync(sourceFile);
    const failures: unknown[] = [];
    try {
      client.assertInputMutationAllowed();
      fs.writeFileSync(
        sourceFile,
        "export const shape = { replacement: 2 };\n",
      );
      const refreshed = membersOf(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: detailsArguments("shape"),
        })) as ToolResult,
        "shape",
      );
      assert.deepEqual(
        refreshed.map((member) => member.name),
        ["replacement"],
      );
      assert.equal(refreshed[0]?.signature, "replacement: 2");
    } catch (error) {
      failures.push(error);
    } finally {
      try {
        client.assertInputMutationAllowed();
        fs.writeFileSync(sourceFile, originalSource);
      } catch (error) {
        client.preventInputReuse("Object outline source restoration failed");
        failures.push(error);
      }
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1)
      throw new AggregateError(
        failures,
        "Object outline request and reset failed",
      );
  });
  if (failures.length)
    throw new AggregateError(failures, "Shared native shape corpus failed");
}
