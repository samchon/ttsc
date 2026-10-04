import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

type Client = {
  request(method: string, params: unknown): Promise<unknown>;
  assertInputMutationAllowed(): void;
  preventInputReuse(reason: string): void;
};
interface Member { name: string; kind: string; line?: number; signature?: string }
interface ToolResult { structuredContent?: unknown }
const detailsArguments = (handle: string) => ({
  question: `What direct members does ${handle} declare?`,
  draft: { reason: "One details request reads actual native identities.", type: "details" },
  review: "Keep the requested direct native declarations.",
  request: { type: "details", handles: [handle] },
});
const membersOf = (result: ToolResult, name: string): Member[] => {
  const value = (result.structuredContent ?? {}) as { result?: { type?: string; nodes?: { name?: string; members?: Member[] }[] } };
  assert.equal(value.result?.type, "details", JSON.stringify(value));
  return value.result?.nodes?.find((node) => node.name === name)?.members ?? [];
};
/**
 * Observes native member shapes and replacement through the existing graph host.
 * @evidence contracts/testing.md#behavioral-verification The actual MCP details reply carries sixteen actual object members that retain kind/order/head/line and eight body-marker exclusions; replacement changes the same resident native outline.
 * @evidence contracts/testing.md#independent-expectations The sixteen literal authored direct keys prescribe the expected native facts independently of extraction; the replacement literal has exactly one named key.
 * @evidence contracts/testing.md#distinguishing-cases Object shorthand/static/dynamic/spread/nested/accessor/callable distinctions coexist; the controlled edit distinguishes a refreshed snapshot from stale identity.
 * @evidence contracts/testing.md#execution-ownership Called once by the selected graph entry with its already initialized client. It creates no launcher, compiler profile or project and invokes no legacy scene.
 * @evidence contracts/e2e.md#necessary-boundary Actual checker snapshot fields and changed native source identities cross the resident MCP serialization boundary.
 * @evidence contracts/e2e.md#shared-execution The object population is staged before the first native snapshot. Readonly shape queries share that snapshot; one deliberate object edit/restore advances the same session rather than creating per-scenario Programs or clients.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The edit captures original bytes and requires actual client's mutation authority before edit/restore. Restoration failure withdraws reuse; the calling graph entry joins the actual host close.
 * @evidence contracts/e2e.md#preserved-coverage Every original object outline and replacement assertion is retained. MCP branch meanings are owned separately by graphMcpCorpus; ranked tour/global-universe, CLI extraction and encoding/other refresh originals are not certified here.
 */
export async function assertGraphNativeShapeCorpus(client: Client, root: string): Promise<void> {
  const failures: unknown[] = [];
  const run = async (name: string, operation: () => Promise<void>) => {
    try { await operation(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
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
        fs.writeFileSync(sourceFile, "export const shape = { replacement: 2 };\n");
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
        throw new AggregateError(failures, "Object outline request and reset failed");

  });
  if (failures.length) throw new AggregateError(failures, "Shared native shape corpus failed");
}
