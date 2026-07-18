import { ITtscGraphDecorator } from "./ITtscGraphDecorator";
import { ITtscGraphEvidence } from "./ITtscGraphEvidence";
import { TtscGraphNodeKind } from "./TtscGraphNodeKind";
import { TtscGraphNodeModifier } from "./TtscGraphNodeModifier";

/**
 * One node in the graph: a declared symbol or a structural container (file,
 * package).
 *
 * The `id` is position-invariant: `path#qualifiedName:kind` (e.g.
 * `src/order.ts#OrderService.create:method`), so inserting a line above a
 * declaration does not re-key it. Line and span live in `evidence` and are
 * never part of identity.
 */
export interface ITtscGraphNode {
  /** Position-invariant identity (see the interface doc for the id grammar). */
  id: string;

  /** What this node represents. */
  kind: TtscGraphNodeKind;

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
   * Decorators written on this declaration, in source order: raw facts
   * (`@Controller`, `@Get`) a consumer interprets without re-parsing source.
   */
  decorators?: ITtscGraphDecorator[];

  /** The declaration span, for display and signatures. */
  evidence?: ITtscGraphEvidence;

  /**
   * The implementation span when a callable/property member is implemented by a
   * function assignment separate from its declaration.
   */
  implementation?: ITtscGraphEvidence;
}
export namespace ITtscGraphNode {
  /** One member of an enum: the name a caller writes and the value it carries. */
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
}
