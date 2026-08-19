// The bundled viewer's display vocabulary and the legend it renders from it.
//
// Separate from `main.ts` because that module fetches and renders on import, so
// nothing can read its constants or exercise its legend without a browser. The
// legend is the surface this file exists to protect: it used to be literal
// markup in `index.html` with each colour repeated in a `style` attribute, and a
// new family shipped into the graph with no entry beside it until someone opened
// both files.

/** The slice of the DOM the legend needs, so a test can drive it without one. */
export interface LegendElement {
  className: string;
  style: { background: string };
  append(...nodes: (LegendElement | string)[]): void;
  prepend(...nodes: (LegendElement | string)[]): void;
}

/** The slice of `document` the legend needs. */
export interface LegendDocument {
  getElementById(id: string): LegendElement | null;
  createElement(tag: string): LegendElement;
}

/**
 * Node colour per declaration kind.
 *
 * Total over the kinds a dump can carry (`TtscGraphDumpNodeKind`). `module` was
 * missing, and because the fallback below was the same string as `variable`, a
 * module was not merely unnamed — it was drawn as a variable.
 */
export const NODE_COLORS: Record<string, string> = {
  module: "#d0d7de",
  class: "#36e2ee",
  interface: "#6ea8ff",
  function: "#3fb950",
  method: "#2bb673",
  type: "#f5b042",
  enum: "#c792ea",
  variable: "#8b97a8",
};

/**
 * Edge colour per display family.
 *
 * One definition: the edge colour, the legend swatch, and the legend name all
 * read this map. `exports` is neutral because it is a structural relation
 * rather than a use, and it is opaque so it stays apart from the translucent
 * fallback.
 */
export const LINK_COLORS: Record<string, string> = {
  "value-call": "#3fb950",
  "type-ref": "#f5b042",
  "doc-ref": "#c07de0",
  heritage: "#6ea8ff",
  exports: "#7d8590",
};

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
