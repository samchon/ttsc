import assert from "node:assert/strict";
import { BatchWorkspace } from "../batch/BatchWorkspace";
import { assertGraphReadonlyCorpus } from "../batch/graphReadonlyCorpus";
import { assertGraphDispatchCorpus } from "../batch/graphDispatchCorpus";
import { TtsgraphClient } from "../internal/graph/internal/ttsgraph";

type NodeDetails = {
  name: string;
  signature?: string;
  literals?: string[];
  members?: { name: string; signature?: string }[]; dependedOnBy?: unknown[];
};

/**
 * Observes multiple independent native declarations through one resident MCP host.
 *
 * @evidence contracts/testing.md#behavioral-verification One real graph session delivers original enum member names, signatures, literal sets, implicit values, duplicate values and the neighboring class outline through an actual details response.
 * @evidence contracts/testing.md#independent-expectations Authored enum declarations prescribe literal names and values before native extraction. The class provides an independent non-enum control.
 * @evidence contracts/testing.md#distinguishing-cases String, implicitly numbered and duplicate-value enums distinguish declared member identity from a deduplicated type-value set; the class outline must remain unaffected.
 * @evidence contracts/testing.md#execution-ownership One TtsgraphClient.start owns one resident MCP/native session; a multi-handle details request and abstract dispatch trace serve all these declarations without CLI dumps or legacy scene dispatch.
 * @evidence contracts/e2e.md#necessary-boundary Real native checker extraction, snapshot transport and built MCP projection must carry each member fact. A synthetic graph cannot certify this producer boundary.
 * @evidence contracts/e2e.md#shared-execution The session borrows the unchanged common source graph and extracts all requested declarations in one request; no per-scene fixture is created.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity The MCP host's stdin is closed and actual process exit awaited after the body. Unknown closure rejects and shared inputs remain retained; no source mutation or force-kill substitutes for completion.
 * @evidence contracts/e2e.md#preserved-coverage Preserves the original enum-details exact assertions with renamed authored Dup/Cls declarations replaced by Duplicate/Service. Retains both original signature head/body controls and both abstract implementation dispatch/terminal controls in this same resident session. Remaining impact and refresh distinctions are not certified.
 */
export async function test_e2e_graph_batch(): Promise<void> {
  const workspace = await BatchWorkspace.open();
  const client = TtsgraphClient.start(workspace.root);
  try {
    await client.request("initialize", {
      protocolVersion: "2025-06-18", capabilities: {},
      clientInfo: { name: "shared-e2e", version: "1" },
    });
    client.notify("notifications/initialized", {});
    await assertGraphReadonlyCorpus(client);
    await assertGraphDispatchCorpus(client);
    const response = await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question: "What names and resolved values do these declarations contain?",
        draft: { reason: "One native declaration population answers all details.", type: "details" },
        review: "Keep the requested independent names and member facts.",
        request: { type: "details", handles: ["Colors", "Implicit", "Duplicate", "Service", "oneLiner", "withTypeLiteral", "Wrapped", "Flat", "LiteralColors", "Indirect", "Widened", "Wide", "Values"], neighbors: true },
      },
    }) as { structuredContent?: { result?: { type?: string; nodes?: NodeDetails[] } } };
    const details = response.structuredContent?.result;
    assert.equal(details?.type, "details");
    assert.ok(details);
    assert.ok(Array.isArray(details.nodes));
    const node = (name: string): NodeDetails | undefined => details.nodes!.find((value) => value.name === name);
    assert.deepEqual(node("Colors")?.members?.map((member) => member.name), ["Colors.Red", "Colors.Green", "Colors.Blue"]);
    assert.equal(node("Colors")?.members?.[0]?.signature, 'Red = "red"');
    assert.deepEqual(node("Colors")?.literals, ['"red"', '"green"', '"blue"']);
    assert.deepEqual(node("Implicit")?.members?.map((member) => member.signature), ["First = 0", "Second = 1"]);
    assert.deepEqual(node("Duplicate")?.members?.map((member) => member.name), ["Duplicate.A", "Duplicate.B"]);
    assert.deepEqual(node("Duplicate")?.literals, ['"x"']);
    assert.deepEqual(node("Service")?.members?.map((member) => member.name), ["Service.run"]);
    const simple = node("oneLiner")?.signature;
    const nested = node("withTypeLiteral")?.signature;
    assert.equal(typeof simple, "string");
    assert.ok(simple.includes("n: number"));
    assert.equal(simple.includes("return n * 2"), false);
    assert.equal(typeof nested, "string");
    assert.ok(nested.includes("port: number"));
    assert.ok(nested.includes("Promise<void>"));
    assert.equal(nested.includes("Promise.resolve()"), false);
    const seven = ['"a"', '"b"', '"c"', '"d"', '"e"', '"f"', '"g"'];
    assert.deepEqual(node("Wrapped")?.literals, seven);
    assert.deepEqual(node("Flat")?.literals, seven);
    assert.deepEqual(node("LiteralColors")?.literals, ['"red"', '"green"', '"blue"']);
    assert.deepEqual(node("Indirect")?.literals, [...seven, '"h"']);
    assert.equal(node("Widened")?.literals, undefined);
    assert.equal(node("Wide")?.members?.length, 20);
    assert.equal(node("Values")?.literals?.length, 20);
    const inbound = node("Wide")?.dependedOnBy?.length ?? 0;
    assert.ok(inbound > 0 && inbound < 20);
    const dispatch = await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question: "What does this abstract run actually reach?",
        draft: { reason: "One resident snapshot supplies checker dispatch edges.", type: "trace" },
        review: "Keep both authored implementation and terminal-name controls.",
        request: { type: "trace", from: "AbstractRunner.run", direction: "forward", focus: "execution", maxDepth: 6, maxNodes: 16 },
      },
    }) as { structuredContent?: { result?: { type?: string; reached: { id: string; name: string }[]; hops: { to: string; kind: string }[] } } };
    const trace = dispatch.structuredContent?.result;
    assert.equal(trace?.type, "trace");
    assert.ok(trace);
    const reached = trace.reached.map((value) => value.name);
    const dispatched = trace.hops.filter((hop) => hop.kind === "dispatches").map((hop) => trace.reached.find((value) => value.id === hop.to)?.name);
    assert.ok(reached.includes("AbstractPipeline.start"));
    assert.ok(dispatched.includes("TransformAbstractPipeline.execute"));
    assert.ok(dispatched.includes("PersistAbstractPipeline.execute"));
    assert.ok(reached.includes("transform"));
    assert.ok(reached.includes("persistAbstract"));
    const inheritedResponse = await client.request("tools/call", {
      name: "inspect_typescript_graph",
      arguments: {
        question: "What does the inherited abstract member execute?",
        draft: { reason: "The same native population contains an inherited implementation.", type: "trace" },
        review: "Keep the original inherited dispatch and terminal controls.",
        request: { type: "trace", from: "InheritedRunner.run", direction: "forward", focus: "execution", maxDepth: 6, maxNodes: 16 },
      },
    }) as { structuredContent?: { result?: { type?: string; reached: { id: string; name: string }[]; hops: { to: string; kind: string }[] } } };
    const inherited = inheritedResponse.structuredContent?.result;
    assert.equal(inherited?.type, "trace");
    assert.ok(inherited);
    const inheritedDispatch = inherited.hops.filter((hop) => hop.kind === "dispatches").map((hop) => inherited.reached.find((value) => value.id === hop.to)?.name);
    assert.ok(inheritedDispatch.includes("ConcreteWorker.process"));
    assert.ok(inherited.reached.some((value) => value.name === "persistInherited"));
    // These are requests on the existing resident host, not new experiments.
    const call = async (request: Record<string, unknown>): Promise<Record<string, unknown>> => {
      const response = await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: { question: "Which authored declarations own these facts?", draft: { reason: "Reuse the same native declaration population.", type: request.type }, review: "Keep the independently authored citation controls.", request },
      }) as { structuredContent?: { result?: Record<string, unknown> } };
      assert.ok(response.structuredContent?.result);
      return response.structuredContent.result;
    };
    type CitationHit = { name: string; docTags?: { name: string; text?: string }[] };
    const markdown = await call({ type: "lookup", query: "docs/discount.md#coupon-stacking" }) as { hits: CitationHit[] };
    assert.deepEqual(markdown.hits.map((hit) => hit.name).sort(), ["applyCoupons", "renderNotice"]);
    for (const hit of markdown.hits)
      assert.deepEqual((hit.docTags ?? []).map((tag) => (tag.text ?? "").split(" ")[0]), ["docs/discount.md#coupon-stacking"]);
    const operation = await call({ type: "lookup", query: "POST:/orders/{orderId}/coupons" }) as { hits: CitationHit[] };
    assert.equal(operation.hits[0]?.name, "renderNotice");
    assert.deepEqual(operation.hits.filter((hit) => hit.docTags !== undefined).map((hit) => hit.name), ["renderNotice"]);
    const citationDetails = await call({ type: "details", handles: ["renderNotice", "untagged", "bootstrap"] }) as { nodes: (CitationHit & { doc?: string })[] };
    const notice = citationDetails.nodes.find((value) => value.name === "renderNotice");
    assert.deepEqual(notice?.docTags, [
      { name: "evidence", text: "docs/discount.md#coupon-stacking States the per-issuer stacking limit this section defines." },
      { name: "evidence", text: "POST:/orders/{orderId}/coupons Explains the rejection." },
    ]);
    assert.equal(notice?.doc, "Renders the stacking notice.");
    assert.equal(citationDetails.nodes.find((value) => value.name === "untagged")?.docTags, undefined);
    const bootLookup = await call({ type: "lookup", query: "docs/boot.md#start" }) as { hits: Record<string, unknown>[] };
    assert.ok(bootLookup.hits.some((hit) => "docTags" in hit));
    const entrypoints = await call({ type: "entrypoints", query: "docs/boot.md#start" }) as { hits: Record<string, unknown>[] };
    assert.ok(entrypoints.hits.length > 0);
    assert.deepEqual(entrypoints.hits.filter((hit) => "docTags" in hit), []);
    assert.ok(citationDetails.nodes.some((value) => value.name === "bootstrap" && "docTags" in value));

    { // Original case_ttscgraph_documentation_links_are_traversable_only_in_full_focus assertions; one existing resident client.
interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { name: string }[];
}

interface DetailsResult {
  type: "details";
  nodes: {
    name: string;
    calls?: { name: string; relation: string }[];
    types?: { name: string; relation: string }[];
    dependsOn?: { name: string; relation: string }[];
    dependedOnBy?: { name: string; relation: string }[];
  }[];
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const resultOf = <T extends { type: string }>(
  result: ToolResult,
  type: string,
): T => {
  const value = (result.structuredContent ?? {}) as { result?: T };
  if (value.result?.type !== type)
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};


      const trace = async (focus: string): Promise<TraceResult> =>
        resultOf<TraceResult>(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `What does DocLinkedNotice reach under ${focus}?`,
              request: {
                type: "trace",
                from: "DocLinkedNotice",
                direction: "forward",
                focus,
                maxDepth: 1,
              },
            }),
          })) as ToolResult,
          "trace",
        );

      const all = await trace("all");
      assert.ok(
        all.reached.some((node) => node.name === "ICited"),
        `the full focus must reach the documented type: ${JSON.stringify(all.reached)}`,
      );
      assert.ok(
        all.hops.some((hop) => hop.kind === "doc_ref"),
        `the full focus must traverse the documentation relation: ${JSON.stringify(all.hops)}`,
      );

      // The narrowed focuses are the point. A documentation mention is not a
      // runtime step and not a type position, so neither may report it.
      const execution = await trace("execution");
      assert.deepStrictEqual(
        execution.reached.map((node) => node.name),
        ["helper"],
        "an execution trace must reach the call and nothing documented",
      );
      const types = await trace("types");
      assert.deepStrictEqual(
        types.reached.map((node) => node.name),
        ["IUsed"],
        "a type trace must reach the annotation and nothing documented",
      );

      const details = resultOf<DetailsResult>(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "What does DocLinkedNotice depend on?",
            request: {
              type: "details",
              handles: ["DocLinkedNotice"],
              neighbors: true,
              // The default neighbour slice is two, and this declaration has
              // three outgoing relations; raise it so the assertion is about
              // where the link lands rather than about the cap.
              neighborLimit: 3,
            },
          }),
        })) as ToolResult,
        "details",
      );
      const notice = details.nodes[0];
      assert.deepStrictEqual(
        notice?.calls?.map((ref) => ref.name),
        ["helper"],
        "a documentation link must not be folded into calls",
      );
      assert.deepStrictEqual(
        notice?.types?.map((ref) => ref.name),
        ["IUsed"],
        "a documentation link must not be folded into type references",
      );
      assert.ok(
        notice?.dependsOn?.some(
          (ref) => ref.name === "ICited" && ref.relation === "doc_ref",
        ),
        `the neighbor summary must carry the link under its own relation: ${JSON.stringify(notice?.dependsOn)}`,
      );

      // The relation reads from the other end too: asking about the cited type
      // shows the declaration whose documentation names it. That is the shape a
      // reader uses to go from a contract to the code answering for it, and it
      // comes from the same edge rather than a second index.
      const cited = resultOf<DetailsResult>(
        (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: graphArguments({
            thinking: "What answers to ICited?",
            request: {
              type: "details",
              handles: ["ICited"],
              neighbors: true,
            },
          }),
        })) as ToolResult,
        "details",
      );
      assert.ok(
        cited.nodes[0]?.dependedOnBy?.some(
          (ref) => ref.name === "DocLinkedNotice" && ref.relation === "doc_ref",
        ),
        `the cited type must list its documenter: ${JSON.stringify(cited.nodes[0]?.dependedOnBy)}`,
      );

      // Neither bounded operation carries a tag. Both are held to a token
      // budget that has been cut twice for this reason, and neither answers a
      // citation question — a tour is asked what the project is and how it
      // runs, and a trace follows what reaches what. The declaration in this
      // fixture does carry a tag, so an absence here is a decision rather than
      // an empty project.
      for (const request of [
        { type: "tour", reinterpretations: [] },
        { type: "trace", from: "DocLinkedNotice", direction: "forward" },
      ]) {
        const payload = JSON.stringify(
          resultOf<{ type: string }>(
            (await client.request("tools/call", {
              name: "inspect_typescript_graph",
              arguments: graphArguments({
                thinking: "What is this project made of?",
                request,
              }),
            })) as ToolResult,
            request.type,
          ),
        );
        assert.ok(
          !payload.includes("docTags"),
          `${request.type} must carry no documentation tag: ${payload.slice(0, 200)}`,
        );
      }

    }

    { // Original case_ttscgraph_dispatch_reads_declaration_facts_not_dependency_degree assertions; one existing resident client.
interface ToolResult {
  structuredContent?: {
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
  path?: { id: string; name: string }[];
}


      const call = async (
        request: Record<string, unknown>,
      ): Promise<TraceResult> => {
        const response = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: {
            question: "What does this call actually run?",
            draft: {
              reason: "A trace is the smallest step for a runtime flow.",
              type: "trace",
            },
            review: "Confirmed: answer from the trace's graph facts.",
            request: { type: "trace", ...request },
          },
        })) as ToolResult;
        const trace = response.structuredContent?.result;
        assert.equal(
          trace?.type,
          "trace",
          `expected a trace result: ${JSON.stringify(response)}`,
        );
        return trace!;
      };

      /** The names a trace reached over a synthesized `dispatches` hop. */
      const dispatchedIn = (trace: TraceResult): string[] =>
        trace.hops
          .filter((hop) => hop.kind === "dispatches")
          .map(
            (hop) =>
              trace.reached.find((node) => node.id === hop.to)?.name ?? hop.to,
          );

      const forward = async (from: string): Promise<TraceResult> =>
        call({ from, direction: "forward", focus: "execution", maxDepth: 4 });

      const emptyBody = await forward("callBodyPipeline");
      assert.ok(
        dispatchedIn(emptyBody).includes("Empty.execute"),
        `an implementation with an empty body is still the code that runs: ${JSON.stringify(emptyBody.hops)}`,
      );

      const dependencyFree = await forward("callReader");
      const readers = dispatchedIn(dependencyFree);
      for (const implementation of [
        "Constant.read",
        "Computed.read",
        "Refusing.read",
      ])
        assert.ok(
          readers.includes(implementation),
          `a body that names nothing modeled is still a body (${implementation}): ${readers.join(", ")}`,
        );

      const abstractTask = await forward("Task.start");
      assert.ok(
        dispatchedIn(abstractTask).includes("QuietTask.perform"),
        `an abstract method dispatches to a dependency-free override: ${JSON.stringify(abstractTask.hops)}`,
      );

      // The other half of the same predicate: a candidate that is itself
      // bodyless is not an implementation. An abstract member standing between
      // an interface and the concrete class is that candidate, and it must
      // never be the destination of a hop that claims to name what runs.
      const abstractCandidate = await forward("callShape");
      assert.ok(
        abstractCandidate.reached.some((node) => node.name === "Shape.area"),
        `the walk stands on the interface member: ${abstractCandidate.reached.map((n) => n.name).join(", ")}`,
      );
      assert.ok(
        !dispatchedIn(abstractCandidate).includes("BaseShape.area"),
        `an abstract member is never a dispatch destination: ${JSON.stringify(abstractCandidate.hops)}`,
      );
      const abstractIntermediate = await forward("BaseShape.area");
      assert.ok(
        dispatchedIn(abstractIntermediate).includes("Square.area"),
        `and the concrete override below it still is: ${JSON.stringify(abstractIntermediate.hops)}`,
      );

      // One implementation named in two heritage clauses is one implementation.
      // The producer records the member pair once per clause, as `overrides`
      // and as `implements`, so a walk over relations would cross to the same
      // body twice and count one class twice against the hub cut.
      const twoRelations = await forward("callTwice");
      assert.deepEqual(
        dispatchedIn(twoRelations),
        ["OnlyOnce.emit"],
        `a doubly related implementation is dispatched to once: ${JSON.stringify(twoRelations.hops)}`,
      );

      const ambient = await forward("callNative");
      assert.ok(
        dispatchedIn(ambient).includes("RealNative.handle"),
        `an ambient member is bodyless by declaration, not by degree: ${JSON.stringify(ambient.hops)}`,
      );

      const concreteEmptyBase = await forward("callBase");
      assert.deepEqual(
        dispatchedIn(concreteEmptyBase),
        [],
        "a concrete base with a body is the destination, not a hop to its override",
      );
      assert.ok(
        !concreteEmptyBase.reached.some((node) =>
          ["Derived.run", "derivedOnly"].includes(node.name),
        ),
        `the override stays out of the flow: ${concreteEmptyBase.reached.map((n) => n.name).join(", ")}`,
      );

      const concreteCallingBase = await forward("callLoud");
      assert.deepEqual(
        dispatchedIn(concreteCallingBase),
        [],
        "the same shape answers the same way when the base body calls a helper",
      );
      assert.ok(
        concreteCallingBase.reached.some((node) => node.name === "bodyAccepted"),
        "the concrete base's own work is still reached",
      );

      const overloads = await forward("callFormatter");
      assert.deepEqual(
        dispatchedIn(overloads),
        [],
        "an overload set resolved to its one implementation dispatches nowhere",
      );
      assert.equal(
        overloads.reached.filter((node) => node.name === "Formatter.format")
          .length,
        1,
        `the implementation is reached exactly once: ${overloads.reached.map((n) => n.name).join(", ")}`,
      );

      const typed = await call({
        from: "callBodyPipeline",
        direction: "forward",
        focus: "types",
        maxDepth: 4,
      });
      assert.deepEqual(
        dispatchedIn(typed),
        [],
        '`focus: "types"` still synthesizes no runtime dispatch',
      );

      const asPath = await call({
        from: "callBodyPipeline",
        to: "Empty.execute",
        focus: "execution",
        maxDepth: 4,
      });
      assert.deepEqual(
        asPath.path?.map((node) => node.name),
        ["callBodyPipeline", "BodyPipeline.execute", "Empty.execute"],
        `path mode agrees with the open trace: ${JSON.stringify(asPath.path)}`,
      );

    }

    { // Original case_ttscgraph_lookup_indexes_addresses_and_not_prose: settled requests on the same native population.
interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface LookupResult {
  type: "lookup";
  hits: { name: string; docTags?: { name: string; text?: string }[] }[];
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const lookupOf = (result: ToolResult): LookupResult => {
  const value = (result.structuredContent ?? {}) as { result?: LookupResult };
  if (value.result?.type !== "lookup")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};


      const lookup = async (query: string): Promise<LookupResult> =>
        lookupOf(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `Looking for ${query}`,
              request: { type: "lookup", query },
            }),
          })) as ToolResult,
        );

      // An address answers through the index.
      const address = await lookup("docs/pricing.md#sale");
      assert.strictEqual(
        address.hits[0]?.name,
        "priced",
        "a real address must answer with its citing declaration",
      );

      // The prose word does not. The declaration actually named `Add` is the
      // answer, and `cached` — whose `@todo` opens with that word — must not
      // appear as a citation carrier at all.
      const prose = await lookup("Add");
      assert.strictEqual(
        prose.hits[0]?.name,
        "Add",
        `a prose word must rank the symbol that bears it: ${JSON.stringify(prose.hits.map((h) => h.name))}`,
      );
      assert.deepStrictEqual(
        prose.hits.filter((hit) => hit.docTags !== undefined),
        [],
        "no declaration may be returned as citing a prose word",
      );

      // A bare number is not an address either.
      const number = await lookup("4");
      assert.deepStrictEqual(
        number.hits.filter((hit) => hit.docTags !== undefined),
        [],
        "a bare number must not index as a citation target",
      );

      // An address the name tokenizer cannot read at all still answers. Its
      // subwords are empty — the tokenizer splits on ASCII alphanumerics — so
      // before the citation pass ran first, this query was refused as carrying
      // no searchable terms while the index held that exact address.
      const korean = await lookup("문서/가격.md#할인");
      assert.deepStrictEqual(
        korean.hits.map((hit) => hit.name),
        ["nonAscii"],
        "an address outside the tokenizer's alphabet must still be answered",
      );

      // A tag with no text names nothing, so it indexes nothing — and it is
      // still carried on the declaration, which `details` shows.
      const bare = await lookup("bareTag");
      assert.deepStrictEqual(
        bare.hits.filter((hit) => hit.docTags !== undefined),
        [],
        "a tag with no text must not enter the citation index",
      );

      // A URL is: it carries separators and is exactly how a reference is
      // spelled.
      const url = await lookup("https://example.com/spec#part");
      assert.strictEqual(
        url.hits[0]?.name,
        "referenced",
        `a URL reference must answer through the index: ${JSON.stringify(url.hits.map((h) => h.name))}`,
      );

    }

    { // Original case_ttscgraph_lookup_returns_every_citing_declaration_of_one_file: settled requests on the same native population.
interface ToolResult {
  content: { type: string; text: string }[];
  structuredContent?: unknown;
}

interface LookupResult {
  type: "lookup";
  hits: { name: string }[];
  truncated?: boolean;
}

const graphArguments = (props: {
  thinking: string;
  request: Record<string, unknown>;
}) => ({
  question: props.thinking,
  draft: {
    reason: "The smallest useful sacred graph step.",
    type: props.request.type,
  },
  review:
    "Confirmed: keep this final request; do not replace graph facts with file reads.",
  request: props.request,
});

const lookupOf = (result: ToolResult): LookupResult => {
  const value = (result.structuredContent ?? {}) as { result?: LookupResult };
  if (value.result?.type !== "lookup")
    throw new Error(`Unexpected graph result: ${JSON.stringify(value)}`);
  return value.result;
};


      const lookup = async (
        query: string,
        limit?: number,
      ): Promise<LookupResult> =>
        lookupOf(
          (await client.request("tools/call", {
            name: "inspect_typescript_graph",
            arguments: graphArguments({
              thinking: `Which code implements ${query}?`,
              request: {
                type: "lookup",
                query,
                ...(limit === undefined ? {} : { limit }),
              },
            }),
          })) as ToolResult,
        );

      const all = await lookup("docs/roster.md#fulfillment");
      assert.deepStrictEqual(
        all.hits.map((hit) => hit.name).sort(),
        ["rosterCarrier1", "rosterCarrier2", "rosterCarrier3", "rosterCarrier4", "rosterCarrier5"],
        "every declaration citing the address must be returned, though they share a file",
      );
      assert.strictEqual(
        all.truncated,
        undefined,
        "nothing was left out, so nothing may claim it was",
      );

      // The negative twin: the per-file cap still governs a name query, which is
      // what it exists for. `rosterCarrier` matches all five by subword.
      const byName = await lookup("rosterCarrier");
      assert.ok(
        byName.hits.length <= 3,
        `a name query must stay capped per file: ${JSON.stringify(byName.hits.map((h) => h.name))}`,
      );

      // A limit below the carrier count cuts, and the result says so rather than
      // presenting three of five as the answer.
      const capped = await lookup("docs/roster.md#fulfillment", 3);
      assert.strictEqual(capped.hits.length, 3);
      assert.strictEqual(
        capped.truncated,
        true,
        "a limit that cut the carriers must be reported",
      );

    }

    { // Original case_ttscgraph_path_reports_its_depth_bound_instead_of_a_disconnection: one existing resident producer.
interface ToolResult {
  structuredContent?: {
    next?: { action?: string; request?: string; reason?: string };
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  path?: { id: string; name: string }[];
  junctions?: unknown[];
}


const OVER_CEILING_HOPS = 13;



      const call = async (
        request: Record<string, unknown>,
      ): Promise<NonNullable<ToolResult["structuredContent"]>> => {
        const response = (await client.request("tools/call", {
          name: "inspect_typescript_graph",
          arguments: {
            question: "How does one end reach the other?",
            draft: {
              reason: "Path mode is the one-call answer for two known ends.",
              type: "trace",
            },
            review: "Confirmed: answer from the path the graph holds.",
            request: { type: "trace", ...request },
          },
        })) as ToolResult;
        assert.equal(
          response.structuredContent?.result?.type,
          "trace",
          `expected a trace result: ${JSON.stringify(response)}`,
        );
        return response.structuredContent!;
      };

      const exhausted = await call({
        from: "apartLeft",
        to: "apartRight",
        focus: "execution",
      });
      assert.equal(
        exhausted.next?.action,
        "outside",
        "an exhausted search with nothing in common keeps its verdict",
      );

      const junctioned = await call({
        from: "holderA",
        to: "holderB",
        focus: "all",
      });
      assert.equal(
        junctioned.next?.action,
        "inspect",
        "an exhausted search over a shared symbol keeps its junction verdict",
      );
      assert.ok(
        (junctioned.result!.junctions?.length ?? 0) > 0,
        `and still names the seam: ${JSON.stringify(junctioned.result!.junctions)}`,
      );

      const boundedSeam = await call({
        from: "seamStart",
        to: "seamEnd",
        focus: "all",
        maxDepth: 2,
      });
      assert.notEqual(
        boundedSeam.next?.action,
        "outside",
        "a walk stopped by the bound is not evidence the graph holds no connection",
      );
      assert.equal(boundedSeam.next?.action, "inspect");
      assert.equal(
        boundedSeam.next?.request,
        "trace",
        "and the continuation is another graph call, not an escape",
      );
      assert.notEqual(
        boundedSeam.next?.reason,
        exhausted.next?.reason,
        "the bound must not be narrated as a proven disconnection",
      );
      assert.notEqual(
        boundedSeam.next?.reason,
        junctioned.next?.reason,
        "nor as a callback seam, when a direct path runs past the bound",
      );
      assert.equal(
        boundedSeam.result!.junctions,
        undefined,
        "a junction explains an absence, and no absence was established",
      );

      const foundSeam = await call({
        from: "seamStart",
        to: "seamEnd",
        focus: "all",
        maxDepth: 3,
      });
      assert.equal(
        foundSeam.next?.action,
        "answer",
        "the same query at the path's own length is unchanged",
      );
      assert.equal(
        foundSeam.result!.hops.length,
        3,
        "and returns the whole path",
      );

      const overCeiling = await call({
        from: "n0",
        to: `n${OVER_CEILING_HOPS}`,
        focus: "execution",
        maxDepth: 12,
      });
      assert.notEqual(
        overCeiling.next?.action,
        "outside",
        "a path longer than the hard ceiling is not reported as absent",
      );
      assert.notEqual(
        overCeiling.next?.reason,
        boundedSeam.next?.reason,
        "at the ceiling the continuation cannot be 'raise maxDepth'",
      );

      const underCeiling = await call({
        from: "n0",
        to: `n${OVER_CEILING_HOPS - 1}`,
        focus: "execution",
        maxDepth: 12,
      });
      assert.equal(
        underCeiling.next?.action,
        "answer",
        "the longest answerable path is still answered",
      );
      assert.equal(underCeiling.result!.hops.length, OVER_CEILING_HOPS - 1);

      const identity = await call({ from: "apartLeft", to: "apartLeft" });
      assert.deepEqual(
        identity.result!.path?.map((node) => node.name),
        ["apartLeft"],
        "the identity path is unchanged",
      );
      assert.equal(identity.next?.action, "answer");

      const oneHop = await call({
        from: "n0",
        to: "n1",
        focus: "execution",
        maxDepth: 1,
      });
      assert.equal(
        oneHop.next?.action,
        "answer",
        "a path exactly as long as the smallest bound is found",
      );

      const externalFrontier = await call({
        from: "edgeStart",
        to: "apartRight",
        focus: "execution",
        maxDepth: 1,
        includeExternal: false,
      });
      assert.equal(
        externalFrontier.next?.action,
        "outside",
        "a frontier of only excluded externals is exhaustion, not a bound",
      );
      const externalEligible = await call({
        from: "edgeStart",
        to: "apartRight",
        focus: "execution",
        maxDepth: 1,
        includeExternal: true,
      });
      assert.equal(
        externalEligible.next?.action,
        "inspect",
        "the same frontier is a bound once those externals are eligible",
      );

      const cyclic = await call({
        from: "ringA",
        to: "apartRight",
        focus: "execution",
        maxDepth: 1,
      });
      assert.equal(
        cyclic.next?.action,
        "outside",
        "a frontier of only already-visited nodes is exhaustion, not a bound",
      );

      const boundedTypes = await call({
        from: "TypeLeaf",
        to: "TypeBase",
        focus: "types",
        maxDepth: 1,
      });
      assert.equal(
        boundedTypes.next?.action,
        "inspect",
        "the type focus is bounded by the same rule",
      );
      const foundTypes = await call({
        from: "TypeLeaf",
        to: "TypeBase",
        focus: "types",
        maxDepth: 2,
      });
      assert.equal(foundTypes.next?.action, "answer");

      const boundedDispatch = await call({
        from: "useEmitter",
        to: "Silent.fire",
        focus: "execution",
        maxDepth: 1,
      });
      assert.equal(
        boundedDispatch.next?.action,
        "inspect",
        "a synthesized dispatch edge beyond the bound is a frontier like any other",
      );
      const foundDispatch = await call({
        from: "useEmitter",
        to: "Silent.fire",
        focus: "execution",
        maxDepth: 2,
      });
      assert.equal(
        foundDispatch.result!.hops.at(-1)?.kind,
        "dispatches",
        `the found path crosses the dispatch: ${JSON.stringify(foundDispatch.result!.hops)}`,
      );

    }

    { // Original case_ttscgraph_trace_reports_only_actual_omissions: one existing resident producer.
interface ToolResult {
  structuredContent?: {
    next?: { action?: string };
    result?: TraceResult;
  };
}

interface TraceResult {
  type: "trace";
  hops: { from: string; to: string; kind: string }[];
  reached: { id: string; name: string }[];
  truncated: boolean;
  path?: { id: string; name: string }[];
  steps?: string[];
  junctions?: unknown[];
  candidates?: { id: string; name: string }[];
}

const graphArguments = (request: Record<string, unknown>) => ({
  question: "Which represented flow does this trace prove?",
  draft: {
    reason: "Trace is the smallest graph operation for this flow boundary.",
    type: "trace",
  },
  review: "Confirmed: keep the trace and answer from its graph facts.",
  request,
});



    const call = async (
      request: Record<string, unknown>,
    ): Promise<NonNullable<ToolResult["structuredContent"]>> => {
      const response = (await client.request("tools/call", {
        name: "inspect_typescript_graph",
        arguments: graphArguments({ type: "trace", ...request }),
      })) as ToolResult;
      assert.equal(
        response.structuredContent?.result?.type,
        "trace",
        `expected a trace result: ${JSON.stringify(response)}`,
      );
      return response.structuredContent!;
    };

    const identity = await call({ from: "identity", to: "identity" });
    assert.deepEqual(
      identity.result!.path?.map((node) => node.name),
      ["identity"],
      "a self trace returns its one-node identity path",
    );
    assert.deepEqual(identity.result!.hops, [], "a self path has zero hops");
    assert.deepEqual(identity.result!.steps, [], "a self path has zero steps");
    assert.equal(
      identity.result!.junctions,
      undefined,
      "a found self path does not search for junctions",
    );
    assert.equal(
      identity.next?.action,
      "answer",
      "zero-hop path existence, not hop count, selects the next action",
    );

    const disconnected = await call({
      from: "identity",
      to: "disconnected",
      focus: "execution",
    });
    assert.equal(
      disconnected.next?.action,
      "outside",
      "distinct disconnected nodes preserve the no-path result",
    );

    const ambiguousStart = await call({ from: "duplicate", to: "duplicate" });
    assert.ok(
      (ambiguousStart.result!.candidates?.length ?? 0) >= 2,
      "an ambiguous start still returns candidates",
    );
    assert.equal(ambiguousStart.next?.action, "clarify");
    const ambiguousTarget = await call({ from: "identity", to: "duplicate" });
    assert.ok(
      (ambiguousTarget.result!.candidates?.length ?? 0) >= 2,
      "an ambiguous target still returns candidates",
    );
    assert.equal(ambiguousTarget.next?.action, "inspect");

    for (const request of [
      { from: "leafStart", direction: "forward" },
      { from: "leaf", direction: "reverse" },
      { from: "leaf", direction: "impact" },
    ]) {
      const complete = await call({
        ...request,
        focus: "execution",
        maxDepth: 1,
        maxNodes: 8,
      });
      assert.equal(
        complete.result!.truncated,
        false,
        `${request.direction} leaf at maxDepth is complete`,
      );
    }

    for (const request of [
      { from: "chainStart", direction: "forward" },
      { from: "reverseLeaf", direction: "reverse" },
      { from: "reverseLeaf", direction: "impact" },
    ]) {
      const omitted = await call({
        ...request,
        focus: "execution",
        maxDepth: 1,
        maxNodes: 8,
      });
      assert.equal(
        omitted.result!.truncated,
        true,
        `${request.direction} eligible continuation beyond maxDepth is omitted`,
      );
    }

    const focusFiltered = await call({
      from: "typeStart",
      direction: "forward",
      focus: "execution",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      focusFiltered.result!.truncated,
      false,
      "a type-only boundary edge filtered from execution focus is not omitted",
    );
    const focusEligible = await call({
      from: "typeStart",
      direction: "forward",
      focus: "all",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      focusEligible.result!.truncated,
      true,
      "the same boundary edge truncates when the selected focus includes it",
    );

    const externalFiltered = await call({
      from: "externalStart",
      direction: "forward",
      focus: "execution",
      includeExternal: false,
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      externalFiltered.result!.truncated,
      false,
      "an excluded external boundary is intentional filtering",
    );
    const externalEligible = await call({
      from: "externalStart",
      direction: "forward",
      focus: "execution",
      includeExternal: true,
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      externalEligible.result!.truncated,
      true,
      "the same external boundary truncates when externals are eligible",
    );

    const cycleOmitted = await call({
      from: "cycleA",
      focus: "execution",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      cycleOmitted.result!.truncated,
      true,
      "an omitted back-edge hop is content even when its node is represented",
    );
    const cycleRepresented = await call({
      from: "cycleA",
      focus: "execution",
      maxDepth: 2,
      maxNodes: 8,
    });
    assert.equal(cycleRepresented.result!.hops.length, 2);
    assert.equal(
      cycleRepresented.result!.truncated,
      false,
      "a represented cycle has no omitted continuation",
    );

    const crossOmitted = await call({
      from: "crossStart",
      focus: "execution",
      maxDepth: 1,
      maxNodes: 8,
    });
    assert.equal(
      crossOmitted.result!.truncated,
      true,
      "an omitted cross-edge hop is content even when both nodes are represented",
    );
    const crossRepresented = await call({
      from: "crossStart",
      focus: "execution",
      maxDepth: 2,
      maxNodes: 8,
    });
    assert.equal(crossRepresented.result!.hops.length, 3);
    assert.equal(crossRepresented.result!.truncated, false);

    const exactNodes = await call({
      from: "exactNodeStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 1,
    });
    assert.equal(exactNodes.result!.reached.length, 1);
    assert.equal(exactNodes.result!.truncated, false);
    const omittedNode = await call({
      from: "overflowNodeStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 1,
    });
    assert.equal(omittedNode.result!.reached.length, 1);
    assert.equal(omittedNode.result!.truncated, true);

    const exactHops = await call({
      from: "exactHopStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 2,
    });
    assert.equal(exactHops.result!.hops.length, 4);
    assert.equal(exactHops.result!.truncated, false);
    const omittedHop = await call({
      from: "overflowHopStart",
      focus: "execution",
      maxDepth: 3,
      maxNodes: 2,
    });
    assert.equal(omittedHop.result!.hops.length, 4);
    assert.equal(omittedHop.result!.truncated, true);
    }
  } finally {
    client.endStdin();
    assert.equal(await client.waitForExit(), 0, client.stderrText());
  }
}







