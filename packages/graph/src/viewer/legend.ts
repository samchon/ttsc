// The bundled viewer's display vocabulary and the legend it renders from it.
//
// Separate from `main.ts` because that module fetches and renders on import, so
// nothing can read its constants or exercise its legend without a browser. The
// legend is the surface this file exists to protect: it used to be literal
// markup in `index.html` with each colour repeated in a `style` attribute, and a
// new family shipped into the graph with no entry beside it until someone opened
// both files.

/**
 * Structural DOM capabilities needed to construct the viewer legend.
 *
 * @evidence contracts/common.md#principled-implementation Text-compatible append/prepend and style/class fields match the browser element operations used by legend construction.
 * @evidence contracts/common.md#clear-and-simple-design The boundary exposes only required DOM capabilities, keeping legend construction independent of renderer startup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Browser elements are supplied structurally without patching DOM globals or adding test-dependent rendering logic.
 * @evidence contracts/common.md#meaningful-documentation Native members identify class/style mutation and node insertion semantics rather than framing production behavior as a test utility.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources signature only: the implementer owns any handle or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms signature only: the implementer owns the algorithm and its cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work signature only: the implementer decides what work is shared.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
 */
export interface LegendElement {
  /** CSS class assignment for generated swatches and their containers. */
  className: string;

  /** Background color property used by a legend swatch. */
  style: { background: string };

  // `unknown[]`, because the real `Document` types these as `(Node | string)[]`
  // and a narrower parameter is not assignable to it. `src/viewer` is excluded
  // from the declaration build, so nothing would have reported that.
  /**
   * Append DOM nodes or strings in argument order after current children.
   *
   * @evidence contracts/common.md#principled-implementation The structural signature admits browser node/string arguments without inventing a different insertion protocol.
   * @evidence contracts/common.md#clear-and-simple-design One required insertion capability supplies swatch content without a larger element wrapper.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Implementations use the host's normal append operation rather than monkey-patching document behavior.
   * @evidence contracts/common.md#meaningful-documentation Native prose states insertion order and accepted browser content categories.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources signature only: the implementer owns any handle or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms signature only: the implementer owns the algorithm and its cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work signature only: the implementer decides what work is shared.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
   */
  append(...nodes: unknown[]): void;

  /**
   * Insert DOM nodes or strings before current children, preserving argument
   * order.
   *
   * @evidence contracts/common.md#principled-implementation Prepending generated legend entries retains the existing footer note after those entries.
   * @evidence contracts/common.md#clear-and-simple-design The host owns child insertion; legend construction does not rebuild the footer.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Existing markup is preserved instead of replaced with fixture-specific HTML.
   * @evidence contracts/common.md#meaningful-documentation Native prose explains ordering relative to existing children.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources signature only: the implementer owns any handle or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms signature only: the implementer owns the algorithm and its cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work signature only: the implementer decides what work is shared.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
   */
  prepend(...nodes: unknown[]): void;
}

/**
 * Document lookup and creation capabilities used by legend construction.
 *
 * @evidence contracts/common.md#principled-implementation Nullable id lookup and element creation represent the browser document operations the legend needs.
 * @evidence contracts/common.md#clear-and-simple-design Two capabilities avoid coupling the legend to the full browser document or 3D scene.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The host is injected through the supported structural boundary without mutating document globals.
 * @evidence contracts/common.md#meaningful-documentation Native method comments explain lookup absence and returned element ownership.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources signature only: the implementer owns any handle or retained state.
 * @evidenceExclude contracts/performance.md#efficient-algorithms signature only: the implementer owns the algorithm and its cost.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work signature only: the implementer decides what work is shared.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
 */
export interface LegendDocument {
  /**
   * Find an existing element by id, returning null when it is absent.
   *
   * @evidence contracts/common.md#principled-implementation Nullable lookup preserves the distinction between a missing footer and an empty existing footer.
   * @evidence contracts/common.md#clear-and-simple-design One host lookup avoids global document access inside the renderer-independent legend.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts Missing markup is not fabricated by replacing document APIs.
   * @evidence contracts/common.md#meaningful-documentation Native prose specifies id lookup and null absence.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources signature only: the implementer owns any handle or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms signature only: the implementer owns the algorithm and its cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work signature only: the implementer decides what work is shared.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
   */
  getElementById(id: string): LegendElement | null;

  /**
   * Create an unattached element for the supplied browser tag name.
   *
   * @evidence contracts/common.md#principled-implementation The host creates ordinary elements subsequently attached through its native insertion capabilities.
   * @evidence contracts/common.md#clear-and-simple-design Creation is separate from placement so one host can serve all generated swatches.
   * @evidence contracts/common.md#prohibited-implementation-shortcuts The contract does not substitute serialized fixture markup for actual element construction.
   * @evidence contracts/common.md#meaningful-documentation Native prose states the tag input and unattached ownership boundary.
   * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources signature only: the implementer owns any handle or retained state.
   * @evidenceExclude contracts/performance.md#efficient-algorithms signature only: the implementer owns the algorithm and its cost.
   * @evidenceExclude contracts/performance.md#reuse-equivalent-work signature only: the implementer decides what work is shared.
   * @evidenceExclude contracts/portability.md#os-neutral-implementation signature only: the implementer owns any path or process work.
   */
  createElement(tag: string): LegendElement;
}

/**
 * Node colour per declaration kind.
 *
 * Total over the kinds a dump can carry (`TtscGraphDumpNodeKind`). `module` was
 * missing, and because the fallback below was the same string as `variable`, a
 * module was not merely unnamed — it was drawn as a variable.
 */
export const NODE_COLORS: Record<string, string> = Object.assign(
  Object.create(null),
  {
    // The artifacts. They are one hue family on purpose: a reader tells a document
    // from a declaration at a glance, and tells the artifacts apart within it.
    markdown_document: "#e8b4b8",
    markdown_section: "#d99ba0",
    prisma_model: "#b8a3e8",
    prisma_column: "#a08fd0",
    prisma_relation: "#8a76c0",
    swagger_operation: "#e8d9a0",
    module: "#d0d7de",
    class: "#36e2ee",
    interface: "#6ea8ff",
    function: "#3fb950",
    method: "#2bb673",
    type: "#f5b042",
    enum: "#c792ea",
    variable: "#8b97a8",
  },
);

/**
 * Edge colour per display family.
 *
 * One definition: the edge colour, the legend swatch, and the legend name all
 * read this map. `exports` is neutral because it is a structural relation
 * rather than a use, and it is opaque so it stays apart from the translucent
 * fallback.
 */
export const LINK_COLORS: Record<string, string> = Object.assign(
  Object.create(null),
  {
    "value-call": "#3fb950",
    "type-ref": "#f5b042",
    "doc-ref": "#c07de0",
    heritage: "#6ea8ff",
    exports: "#7d8590",
  },
);

/**
 * What an unrecognized node kind is drawn in.
 *
 * It has to differ from every value in {@link NODE_COLORS}, or "I do not know
 * this kind" and "this is a variable" are the same picture.
 */
export const UNKNOWN_NODE_COLOR = "#565f6b";

/** What an unrecognized edge kind is drawn in; translucent, unlike a family. */
export const UNKNOWN_LINK_COLOR = "#ffffff55";

/** Elements whose legend is already built, so a second call adds nothing. */
const rendered = new WeakSet<LegendElement>();

/**
 * Fill the footer legend from {@link LINK_COLORS}, so a family cannot be drawn
 * without being named.
 *
 * The swatches are prepended, which puts them ahead of the static note the
 * markup keeps — the order the hand-written markup had. The website viewer has
 * always derived its legend this way
 * (`website/src/components/graph/TtscWebsiteGraphViewer3D.tsx`).
 *
 * @evidence contracts/common.md#principled-implementation The shared link-color map supplies every generated family name and swatch, and a WeakSet prevents duplicate insertion into the same footer.
 * @evidence contracts/common.md#clear-and-simple-design This DOM-only module is separate from fetch/3D startup; element construction and insertion stay with the injected document boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Legend names and colors derive from the rendering vocabulary rather than repeated fixture-specific markup.
 * @evidence contracts/common.md#meaningful-documentation Native paragraphs explain map ownership and insertion before the static note, with typed host capabilities documented separately.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources the WeakSet holds the footer element weakly and the function opens no handle.
 * @evidenceExclude contracts/performance.md#efficient-algorithms one map over the five link colors.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work a WeakSet guard skips a legend that is already rendered, which is the only work it shares.
 * @evidenceExclude contracts/portability.md#os-neutral-implementation builds DOM nodes through the supplied document; no file, path or process.
 */
export function renderLegend(host: LegendDocument): void {
  const legend = host.getElementById("legend");
  if (legend === null || rendered.has(legend)) return;
  rendered.add(legend);
  legend.prepend(
    ...Object.entries(LINK_COLORS).map(([kind, color]) => {
      const dot = host.createElement("span");
      dot.className = "dot";
      const swatch = host.createElement("span");
      swatch.className = "swatch";
      swatch.style.background = color;
      dot.append(swatch, kind);
      return dot;
    }),
  );
}
