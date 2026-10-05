import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
type Client = { request(method: string, params: unknown): Promise<unknown>; assertInputMutationAllowed(): void; preventInputReuse(reason: string): void };
/**
 * Exercises distinct invalidation triggers through the existing native graph session.
 * @evidence contracts/testing.md#behavioral-verification Actual source rename changes positive/negative names, comment-only bytes move citation hits, root additions/deletions change membership, and invalid/restored config refuses stale facts and recovers.
 * @evidence contracts/testing.md#independent-expectations BeforeEdit/AfterEdit, OriginalRoot/AddedRoot, literal citation addresses and malformed JSON prescribe expected generations independently of extraction.
 * @evidence contracts/testing.md#distinguishing-cases Code, comment-only, root-add/delete and invalid/restored configuration remain separate triggers; combining them could mask the trigger-specific defect.
 * @evidence contracts/testing.md#execution-ownership Called once by the selected graph entry with its actual initialized client/root. Groups create no project, profile or launcher and execute no legacy function.
 * @evidence contracts/e2e.md#necessary-boundary Actual native invalidation/model replacement and MCP fail-closed conversion must respond while the same public client lives; a cold model cannot certify these transitions.
 * @evidence contracts/e2e.md#shared-execution All declarations are upfront. Distinct trigger phases advance the same resident snapshot without rematerializing fixtures or selecting case profiles. Necessary refresh/revalidation/backend work is not claimed one Program or zero cost.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Each trigger captures prior bytes/presence, demands actual mutation authority and restores after settled requests. Restore failure withdraws reuse; the outer selected entry joins actual process close.
 * @evidence contracts/e2e.md#preserved-coverage All four original assertion bodies and restoration failures remain. Independent group failures are collected; lost authority prevents unsafe writes rather than inventing recovery.
 */
export async function assertGraphRefreshCorpus(client: Client, root: string): Promise<void> {
  const failures: unknown[] = [];
  for (const [name, operation] of [["source-refresh", SourceRefresh.verify], ["tag-only-refresh", TagRefresh.verify], ["root-membership-refresh", RootRefresh.verify], ["invalid-config-recovery", ConfigRefresh.verify]] as const) {
    try { await operation(client, root); } catch (cause) { failures.push(new Error(name, { cause })); }
  }
  if (failures.length) throw new AggregateError(failures, "Native resident refresh population failed");
}
namespace SourceRefresh {
interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookupArguments = (query: string) => ({
  question: `Look up ${query} in the current TypeScript source snapshot.`,
  draft: {
    reason: "A named symbol lookup is the smallest useful graph request.",
    type: "lookup",
  },
  review: "Confirmed: use one lookup against the current source snapshot.",
  request: {
    type: "lookup",
    query,
  },
});

const lookupNames = (result: ToolResult): string[] => {
  const value = (result.structuredContent ?? {}) as {
    result?: { type?: string; hits?: { name?: string }[] };
  };
  assert.equal(value.result?.type, "lookup", JSON.stringify(value));
  return (value.result?.hits ?? []).flatMap((hit) =>
    typeof hit.name === "string" ? [hit.name] : [],
  );
};


export async function verify(client: Client, root: string): Promise<void> {

      const sourceFile = path.join(root, "src", "source-refresh.ts");
      const originalSource = fs.readFileSync(sourceFile);
      const failures: unknown[] = [];
      try {

        const before = lookupNames(
          (await client.request("tools/call", {
            name: GRAPH_TOOL_NAME,
            arguments: lookupArguments("BeforeEdit"),
          })) as ToolResult,
        );
        assert.ok(before.includes("BeforeEdit"), JSON.stringify(before));

        client.assertInputMutationAllowed();
        fs.writeFileSync(
          path.join(root, "src", "source-refresh.ts"),
          "export class AfterEdit {}\n",
        );

        const after = lookupNames(
          (await client.request("tools/call", {
            name: GRAPH_TOOL_NAME,
            arguments: lookupArguments("AfterEdit"),
          })) as ToolResult,
        );
        assert.ok(after.includes("AfterEdit"), JSON.stringify(after));

        const stale = lookupNames(
          (await client.request("tools/call", {
            name: GRAPH_TOOL_NAME,
            arguments: lookupArguments("BeforeEdit"),
          })) as ToolResult,
        );
        assert.ok(!stale.includes("BeforeEdit"), JSON.stringify(stale));
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          client.assertInputMutationAllowed();
          fs.writeFileSync(sourceFile, originalSource);
        } catch (error) {
          client.preventInputReuse("Changed source restoration failed");
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Source refresh requests and reset failed");

}
}

namespace TagRefresh {
interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const lookupArguments = (query: string) => ({
  question: `Which code implements ${query}?`,
  draft: {
    reason: "A documentation target is the smallest useful graph request.",
    type: "lookup",
  },
  review: "Confirmed: use one lookup against the current source snapshot.",
  request: {
    type: "lookup",
    query,
  },
});

const lookupNames = (result: ToolResult): string[] => {
  const value = (result.structuredContent ?? {}) as {
    result?: { type?: string; hits?: { name?: string }[] };
  };
  assert.equal(value.result?.type, "lookup", JSON.stringify(value));
  return (value.result?.hits ?? []).flatMap((hit) =>
    typeof hit.name === "string" ? [hit.name] : [],
  );
};


export async function verify(client: Client, root: string): Promise<void> {

      const sourceFile = path.join(root, "src", "tag-refresh.ts");
      const originalSource = fs.readFileSync(sourceFile);
      const failures: unknown[] = [];
      try {

        const lookup = async (query: string): Promise<string[]> =>
          lookupNames(
            (await client.request("tools/call", {
              name: "inspect_typescript_graph",
              arguments: lookupArguments(query),
            })) as ToolResult,
          );

        assert.deepStrictEqual(
          await lookup("refreshspec/citationalpha#citationalpha"),
          ["subject"],
          "the original address must answer before the edit",
        );

        client.assertInputMutationAllowed();
        // Only the comment changes: the declaration below it is byte-identical.
        fs.writeFileSync(
          path.join(root, "src", "tag-refresh.ts"),
          [
            "/** @evidence refreshspec/citationbeta#citationbeta The section this implements. */",
            "export function subject(): void {}",
            "",
          ].join("\n"),
          "utf8",
        );

        assert.deepStrictEqual(
          await lookup("refreshspec/citationbeta#citationbeta"),
          ["subject"],
          "the new address must answer without restarting the session",
        );
        assert.deepStrictEqual(
          await lookup("refreshspec/citationalpha#citationalpha"),
          [],
          "the replaced address must stop answering",
        );
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          client.assertInputMutationAllowed();
          fs.writeFileSync(sourceFile, originalSource);
        } catch (error) {
          client.preventInputReuse("Tag-only source restoration failed");
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Tag-only requests and reset failed");

}
}

namespace RootRefresh {
interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookup = async (
  client: Client,
  query: string,
): Promise<string[]> => {
  const result = (await client.request("tools/call", {
    name: GRAPH_TOOL_NAME,
    arguments: {
      question: `Look up ${query} in the current TypeScript project roots.`,
      draft: {
        reason: "A named symbol lookup is the smallest graph request.",
        type: "lookup",
      },
      review: "Confirmed: query the synchronized graph once.",
      request: { type: "lookup", query },
    },
  })) as ToolResult;
  const value = (result.structuredContent ?? {}) as {
    result?: { type?: string; hits?: { name?: string }[] };
  };
  assert.equal(value.result?.type, "lookup", JSON.stringify(value));
  return (value.result?.hits ?? []).flatMap((hit) =>
    typeof hit.name === "string" ? [hit.name] : [],
  );
};


export async function verify(client: Client, root: string): Promise<void> {

      const originalFile = path.join(root, "src", "original.ts");
      const addedFile = path.join(root, "src", "added.ts");
      const originalSource = fs.readFileSync(originalFile);
      let addedSource: Buffer | undefined;
      try {
        addedSource = fs.readFileSync(addedFile);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      const failures: unknown[] = [];
      try {

        assert.ok(
          (await lookup(client, "OriginalRoot")).includes("OriginalRoot"),
        );
        client.assertInputMutationAllowed();
        fs.writeFileSync(
          path.join(root, "src", "added.ts"),
          "export class AddedRoot {}\n",
        );
        assert.ok((await lookup(client, "AddedRoot")).includes("AddedRoot"));

        client.assertInputMutationAllowed();
        fs.rmSync(path.join(root, "src", "original.ts"));
        assert.ok(
          !(await lookup(client, "OriginalRoot")).includes("OriginalRoot"),
        );
      } catch (error) {
        failures.push(error);
      } finally {
        for (const [file, bytes] of [
          [originalFile, originalSource],
          [addedFile, addedSource],
        ] as const) {
          try {
            client.assertInputMutationAllowed();
            if (bytes === undefined) fs.rmSync(file, { force: true });
            else fs.writeFileSync(file, bytes);
          } catch (error) {
            client.preventInputReuse("Added/deleted root restoration failed");
            failures.push(error);
          }
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(failures, "Root refresh requests and resets failed");

}
}

namespace ConfigRefresh {
interface ToolResult {
  isError?: boolean;
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

const GRAPH_TOOL_NAME = "inspect_typescript_graph";

const lookupArguments = (query: string) => ({
  question: `Look up ${query} in the synchronized TypeScript graph.`,
  draft: {
    reason: "A named lookup is the smallest graph request.",
    type: "lookup",
  },
  review: "Confirmed: use the current graph snapshot.",
  request: { type: "lookup", query },
});


export async function verify(client: Client, root: string): Promise<void> {

      const initial = (await client.request("tools/call", {
        name: GRAPH_TOOL_NAME,
        arguments: lookupArguments("Recoverable"),
      })) as ToolResult;
      assert.equal(initial.isError, undefined, initial.content[0]?.text);

      const config = path.join(root, "tsconfig.json");
      const original = fs.readFileSync(config);
      const failures: unknown[] = [];
      try {
        client.assertInputMutationAllowed();
        fs.writeFileSync(config, "{ invalid");
        const invalid = (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("Recoverable"),
        })) as ToolResult;
        assert.equal(invalid.isError, true, JSON.stringify(invalid));
        assert.match(invalid.content[0]?.text ?? "", /invalid project/i);

        client.assertInputMutationAllowed();
        fs.writeFileSync(config, original);
        const recovered = (await client.request("tools/call", {
          name: GRAPH_TOOL_NAME,
          arguments: lookupArguments("Recoverable"),
        })) as ToolResult;
        assert.equal(recovered.isError, undefined, recovered.content[0]?.text);
        assert.match(
          JSON.stringify(recovered.structuredContent ?? {}),
          /Recoverable/,
        );
      } catch (error) {
        failures.push(error);
      } finally {
        try {
          client.assertInputMutationAllowed();
          fs.writeFileSync(config, original);
        } catch (error) {
          client.preventInputReuse(
            "Invalid-config recovery restoration failed",
          );
          failures.push(error);
        }
      }
      if (failures.length === 1) throw failures[0];
      if (failures.length > 1)
        throw new AggregateError(
          failures,
          "Invalid-config recovery and reset failed",
        );

}
}
