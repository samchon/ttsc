import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphDocTag } from "./ITtscGraphDocTag";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";
import { TtscGraphNodeKind } from "./TtscGraphNodeKind";
import { TtscGraphNodeModifier } from "./TtscGraphNodeModifier";

/**
 * One node in the graph: a declared symbol or a synthesized file container.
 *
 * The `id` is position-invariant: `path#qualifiedName:kind` (e.g.
 * `src/order.ts#OrderService.create:method`), so inserting a line above a
 * declaration does not re-key it. Line and span live in `evidence` and are
 * never part of identity.
 *
 * @evidence contracts/common.md#principled-implementation Stable ids separate declaration identity from movable source positions; optional fields retain only facts the producer collected.
 * @evidence contracts/common.md#clear-and-simple-design One node record groups identity, declaration shape and grounding while artifact parent and native flags remain optional facets.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Dynamic object members and non-enumerable types receive no fabricated outline or sampled literal set.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain stable identity, optional capability-backed facts and source-versus-implementation spans.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
 */
export interface ITtscGraphNode {
  /** Position-invariant identity (see the interface doc for the id grammar). */
  id: string;

  /** What this node represents. */
  kind: TtscGraphNodeKind;

  /**
   * The artifact containing this one, by id.
   *
   * Present only on an artifact node — a section's document or enclosing
   * section, a column's model. A declaration's containment is synthesized by
   * the memory layer from its owner and its file, which an artifact has no
   * equivalent of: a Prisma model has no file in its address, and an API
   * operation has no file at all.
   */
  parent?: string;

  /** The simple, unqualified declared name (`create`, `OrderService`, `App`). */
  name: string;

  /**
   * The owner-qualified name, when the node lives inside another declaration:
   * `OrderService.create`, `Shopping.ISale`. Absent for a top-level
   * declaration.
   */
  qualifiedName?: string;

  /** Project-relative path of the file that declares this node. */
  file: string;

  /**
   * True when the declaration is outside the workspace (a dependency): kept as
   * a named endpoint, not walked into.
   */
  external: boolean;

  /**
   * True when `file` is git-ignored generated code (Prisma client, codegen
   * output); projections desurface these so generated nodes do not bury the
   * authored graph.
   */
  ignored?: boolean;

  /** True when the symbol is part of its module's export surface. */
  exported?: boolean;

  /**
   * True for a declaration made inside another declaration's body: Vue's
   * `baseCreateRenderer.patch`, a callback bound to a const inside a method.
   *
   * It is a name the runtime calls, so a trace, a lookup, or a details request
   * answers with it. An orientation tour does not rank or walk it: a tour is
   * asked what the project's surface is and how it runs, and a body's inner
   * functions are neither — letting them into the seed ranking reshuffled which
   * flows a tour told, and the model went back to the files.
   */
  closure?: boolean;

  /** Declaration modifiers, when the declaration pass recorded any. */
  modifiers?: TtscGraphNodeModifier[];

  /**
   * The complete value set of a type alias or enum whose declared type the
   * checker resolved to literals, each in TypeScript source form (`"a"`, `1`,
   * `true`, `null`).
   *
   * Present only when every constituent is enumerable, so the list is the whole
   * type and never a sample of it: `type T = Kind | string` admits values no
   * list can name and carries none. It is resolved from the type, not read off
   * the declaration, so indirection (`type I = Kind | 'f'`) is followed and the
   * answer does not depend on how the declaration is wrapped.
   */
  literals?: string[];

  /**
   * What an enum declares, in checker order: the name a caller writes and the
   * value it carries. Absent on every other kind.
   *
   * `literals` says which values the enum admits, which is what a serializer
   * asks. The code says `Colors.Red`, so the names are the other half, and
   * without them a caller that had already named the enum still had to open the
   * file to learn what to type. The members are not nodes — `Colors.Red` is a
   * string a grep finds exactly — so this fills in the node the graph already
   * holds instead of minting one per member.
   */
  enumMembers?: ITtscGraphNode.IEnumMember[];

  /**
   * Direct, statically named members when this variable is initialized with an
   * object literal, in declaration order.
   *
   * The native builder takes identity from the compiler AST and renders the
   * compact signature from the same Program-owned source snapshot. A spread or
   * dynamic computed name has no declaration name it can report soundly, so it
   * contributes no fabricated member.
   */
  objectMembers?: ITtscGraphNode.IObjectMember[];

  /**
   * Decorators written on this declaration, in source order: raw facts
   * (`@Controller`, `@Get`) a consumer interprets without re-parsing source.
   */
  decorators?: ITtscGraphDecorator[];

  /**
   * Documentation tags TypeScript does not recognize, in source order: raw
   * facts (`@evidence docs/pricing.md#sale`, `@reference …`) a consumer
   * interprets without re-parsing source.
   *
   * This is where a declaration says what outside the type system it answers
   * to. A plugin may also publish an artifact node for that target; the raw tag
   * remains a declaration fact independently of whether such a node exists.
   *
   * Read it only when `provenance.capabilities` lists `docTags`. Without that
   * claim the field is absent because the producer never looked, which is a
   * different fact from a declaration that carries none.
   */
  docTags?: ITtscGraphDocTag[];

  /**
   * The declaration head, cut by the producer where the compiler says the body
   * opens.
   *
   * Absent when the producer could not bound the head. Consumers omit the
   * signature rather than infer it from a physical line, which may contain an
   * implementation body or only part of a multiline declaration head.
   */
  signature?: string;

  /** The declaration span, for display and signatures. */
  evidence?: ITtscGraphEvidence;

  /**
   * The implementation span when a callable/property member is implemented by a
   * function assignment separate from its declaration.
   */
  implementation?: ITtscGraphEvidence;
}
export namespace ITtscGraphNode {
  /**
   * One member of an enum: the name a caller writes and the value it carries.
   *
   * @evidence contracts/common.md#principled-implementation Required name and optional folded value preserve computed enum members whose names remain known when values do not.
   * @evidence contracts/common.md#clear-and-simple-design Two fields retain the callable spelling and value without minting a separate member node.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Unfoldable values remain absent rather than receiving expected literals.
   * @evidence contracts/common.md#meaningful-documentation Native comments explain unqualified names and TypeScript source spelling of optional constants.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IEnumMember {
    /** The member's own name, unqualified (`Red` on `Colors.Red`). */
    name: string;

    /**
     * The value it carries, in TypeScript source form (`"red"`, `1`). Absent
     * for a computed member the checker could not fold to a constant; the name
     * still stands.
     */
    value?: string;
  }

  /**
   * One direct, statically named member of an object-literal variable.
   *
   * @evidence contracts/common.md#principled-implementation Static name, data/callable kind and optional coordinates express a source-visible member rather than dynamic runtime keys.
   * @evidence contracts/common.md#clear-and-simple-design The outline stores only declaration presentation; relationships remain on graph nodes.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Spreads and unresolved computed names do not acquire invented member identities.
   * @evidence contracts/common.md#meaningful-documentation Comments document the property/method distinction, one-based line and compiler-snapshot signature.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources data shape only: it holds no handle, task or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms data shape only: it contains no loop or algorithm.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work data shape only: it computes nothing another request could share.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation data shape only: it touches no file, path or process.
   */
  export interface IObjectMember {
    /** The source-visible static property name. */
    name: string;

    /** Whether the declaration is a data property or callable/accessor member. */
    kind: "property" | "method";

    /** 1-based declaration line in the node's file, when source was available. */
    line?: number;

    /** Compact declaration outline rendered from the compiler source snapshot. */
    signature?: string;
  }
}
