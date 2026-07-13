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
