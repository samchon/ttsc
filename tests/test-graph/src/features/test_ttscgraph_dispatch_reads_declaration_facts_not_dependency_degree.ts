import { withIdentityBoundary } from "../internal/identityBoundary";
import { assert } from "../internal/ttsgraph";

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

/**
 * Verifies a dispatch hop is decided by what a declaration is, not by how many
 * modeled symbols its body happens to name.
 *
 * Body detection used to count outgoing `calls`/`accesses`/`instantiates`/
 * `renders` edges, which measures dependency degree instead. That is wrong in
 * both directions: an implementation whose body is empty, returns a literal,
 * throws, or only moves locals around scored zero and was refused as a dispatch
 * target, so the trace dead-ended on the declaration and reported nothing was
 * omitted; and a concrete base method was promoted through its own override the
 * moment its body stopped naming anything the graph models, so two graphs
 * identical in every declaration fact answered differently because of one
 * statement inside a body. The declaration facts the fix reads — kind,
 * `abstract`/`declare` modifiers, and interface or ambient ownership — are only
 * proven end to end through the real producer, which is why this runs the
 * shipped binary rather than a synthetic in-memory graph.
 *
 * 1. Materialize implementations that name nothing (empty, literal, local
 *    arithmetic, thrown literal) behind an interface member, an abstract
 *    method, and an ambient `declare class` member, plus two concrete bases
 *    with overrides that differ only in one statement, an abstract member
 *    standing between an interface and its concrete class, one implementation
 *    named in two heritage clauses, and an overload set.
 * 2. Trace forward from each caller through the real MCP launcher, and request the
 *    same continuation in path mode.
 * 3. Assert every genuinely bodyless declaration dispatches to its dependency-
 *    free implementation, that neither concrete base is promoted through its
 *    override, that no bodyless candidate is admitted as an implementation, and
 *    that `focus: "types"` still synthesizes nothing.
 *
 * @evidence contracts/testing.md#behavioral-verification MCP trace dispatch follows bodyless declarations to real implementations, excludes concrete empty/literal/arithmetic/throwing bodies and helpers, deduplicates double heritage, and returns the exact BodyPipeline execution path.
 * @evidence contracts/testing.md#independent-expectations Authored declaration modifiers and bodies independently decide whether dispatch is needed; literal expected path names and negative implementation names distinguish edge-count guesses.
 * @evidence contracts/testing.md#distinguishing-cases Abstract, interface and ambient members contrast concrete bodies, overload implementation and types-only focus; double implements/override relations still produce one implementation hop.
 * @evidence contracts/testing.md#execution-ownership The features export test_ttscgraph_dispatch_reads_declaration_facts_not_dependency_degree starts the installed MCP launcher and reaches the native resident graph through stdio; it remains in the E2E runner/Evidence population, with the per-case assertions above rather than source-unit execution.
 * @evidence contracts/e2e.md#necessary-boundary The checker must publish body/modifier/container and heritage facts before transported graph traversal can distinguish concrete zero-degree methods from declarations.
 * @evidence contracts/e2e.md#shared-execution Eighteen identity/display, documentation/citation, DTO/audit and dispatch entries borrow one composite project, initialized MCP session and resident native compiler. Only the object-source mutation requires a new generation. The checker-rejection entry also executes the public dump CLI once because diagnostics/raw edges are a separate entrypoint connection; all named assertions remain.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity Unique source files, symbol names and citation targets isolate fixtures; disjoint dispatch contracts and hub populations prevent cross-case implementations. Role-sensitive sources retain their spec/test suffix and real dependency declarations stay external. Only object-outline.ts changes; suite finally closes the shared client and checks successful exit after complete collection.
 * @evidence contracts/e2e.md#preserved-coverage Positive dispatch, negative concrete/helper dispatch, deduplication, types-focus and exact-path assertions remain here. A direct predicate test alone cannot replace the native fact-production coverage.
 */
export const test_ttscgraph_dispatch_reads_declaration_facts_not_dependency_degree =
  async () => {
    await withIdentityBoundary(async (client) => {
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
    });
  };
