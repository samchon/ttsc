// The imperative three.js scene behind the 3D viewer. Built once per mount;
// the React shell drives it through the returned handle (data, highlight,
// camera focus) and never touches three.js itself. Every rendering import is
// dynamic so nothing touches `window` during static export.
import type { ITtscWebsiteGraphViewer } from "../../structures/ITtscWebsiteGraphViewer";
import TtscWebsiteGraphViewerModel from "./TtscWebsiteGraphViewerModel";
import type {
  ViewerHighlight,
  ViewerSlice,
} from "./TtscWebsiteGraphViewerModel";

type ViewerLink = ITtscWebsiteGraphViewer.Link;
type ViewerNode = ITtscWebsiteGraphViewer.Node;

const { LINK_COLORS, NODE_COLORS, linkKey } = TtscWebsiteGraphViewerModel;

// Dimmed nodes must stay clearly visible against the pale-blue background: a
// spotlight grays the rest out, it never makes them look removed.
const DIMMED_NODE = "#b8c8d8";
const DIMMED_LINK = "#d5e2ee";
const SELECTED_NODE = "#102a43";

/** A handle the React shell uses to drive the imperative scene. */
export interface GraphScene {
  setData(slice: ViewerSlice): void;
  setHighlight(highlight: ViewerHighlight | null): void;
  /** Fly the camera to a node, keeping the current viewing direction. */
  focusNode(id: string): void;
  dispose(): void;
}

export interface GraphSceneOptions {
  height: number;
  /** A resolved node was clicked, or `null` for a background click. */
  onNodeClick(node: ViewerNode | null): void;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Link endpoints become node objects once the force engine ingests them. */
function endpointId(endpoint: unknown): string {
  return typeof endpoint === "object" && endpoint !== null
    ? String((endpoint as { id: unknown }).id)
    : String(endpoint);
}

export async function createGraphScene(
  container: HTMLDivElement,
  options: GraphSceneOptions,
): Promise<GraphScene> {
  const THREE = await import("three");
  const { OrbitControls } =
    await import("three/examples/jsm/controls/OrbitControls.js");
  const ThreeForceGraph = (await import("three-forcegraph")).default;

  const height = options.height;
  const width = container.clientWidth || 800;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf7fbff);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const key = new THREE.DirectionalLight(0xffffff, 0.8);
  key.position.set(1, 1, 1);
  scene.add(key);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1e6);
  camera.position.set(0, 0, 320);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.18;

  // The highlight lives in this closure; the color accessors read it, and
  // re-assigning fresh accessor closures forces the graph to repaint without
  // restarting the force simulation.
  let highlight: ViewerHighlight | null = null;
  const nodeColor = () => (node: ViewerNode) => {
    if (!highlight) return NODE_COLORS[node.kind] ?? "#64748b";
    if (node.id === highlight.selectedId) return SELECTED_NODE;
    if (highlight.neighborIds.has(node.id))
      return NODE_COLORS[node.kind] ?? "#64748b";
    return DIMMED_NODE;
  };
  const linkColor = () => (link: ViewerLink) => {
    const base = LINK_COLORS[link.kind] ?? "#94a3b8";
    if (!highlight) return base;
    return highlight.linkKeys.has(
      linkKey(endpointId(link.source), endpointId(link.target)),
    )
      ? base
      : DIMMED_LINK;
  };

  const graph = new ThreeForceGraph<ViewerNode, ViewerLink>()
    .nodeId("id")
    .nodeRelSize(4)
    .nodeResolution(12)
    .nodeOpacity(0.95)
    .nodeVal((node) => 1 + Math.sqrt(node.degree))
    .nodeColor(nodeColor())
    .linkColor(linkColor())
    .linkOpacity(0.4)
    .linkWidth(0)
    .warmupTicks(20)
    .cooldownTicks(160);
  scene.add(graph);

  // Frame the camera on the graph's bounding box at a 3/4 angle.
  const fitCamera = () => {
    const b = graph.getGraphBbox();
    if (!b) return;
    const cx = (b.x[0] + b.x[1]) / 2;
    const cy = (b.y[0] + b.y[1]) / 2;
    const cz = (b.z[0] + b.z[1]) / 2;
    const radius = Math.max(
      (b.x[1] - b.x[0]) / 2,
      (b.y[1] - b.y[0]) / 2,
      (b.z[1] - b.z[0]) / 2,
      10,
    );
    const dist = radius * 2.6;
    camera.position.set(cx + dist * 0.5, cy + dist * 0.32, cz + dist * 0.8);
    camera.near = Math.max(0.1, dist / 200);
    camera.far = dist * 20;
    camera.updateProjectionMatrix();
    controls.target.set(cx, cy, cz);
    controls.update();
  };
  let fitTimer = 0;
  graph.onEngineStop(() => fitCamera());

  // Camera fly-to: the animate loop eases toward these targets until close.
  let flyPosition: InstanceType<typeof THREE.Vector3> | null = null;
  let flyLookAt: InstanceType<typeof THREE.Vector3> | null = null;

  // Hover: raycast the node objects (each carries __data) for a tooltip.
  const tooltip = document.createElement("div");
  tooltip.style.cssText =
    "position:absolute;display:none;pointer-events:none;z-index:10;max-width:22rem;padding:4px 7px;border-radius:6px;background:#fffffff2;border:1px solid #b9d5ee;box-shadow:0 12px 30px rgba(49,120,198,.16);font:11px ui-monospace,monospace;color:#102a43";
  container.appendChild(tooltip);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let hoverNode: ViewerNode | null = null;
  const resolveHover = (event: PointerEvent | MouseEvent) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(graph.children, true);
    hoverNode = null;
    for (const hit of hits) {
      let obj: import("three").Object3D | null = hit.object;
      while (obj) {
        const meta = obj as { __graphObjType?: string; __data?: unknown };
        if (meta.__graphObjType === "node" && meta.__data) {
          hoverNode = meta.__data as ViewerNode;
          break;
        }
        obj = obj.parent;
      }
      if (hoverNode) break;
    }
    return rect;
  };
  const onPointerMove = (event: PointerEvent) => {
    const rect = resolveHover(event);
    renderer.domElement.style.cursor = hoverNode ? "pointer" : "";
    if (!hoverNode) {
      tooltip.style.display = "none";
      return;
    }
    tooltip.style.display = "block";
    tooltip.style.left = `${event.clientX - rect.left + 12}px`;
    tooltip.style.top = `${event.clientY - rect.top + 12}px`;
    tooltip.innerHTML =
      `${escapeHtml(hoverNode.name)}<br/>` +
      `<span style="color:#64748b">${escapeHtml(hoverNode.kind)} · ${escapeHtml(hoverNode.file)}</span>`;
  };
  const onPointerLeave = () => {
    hoverNode = null;
    tooltip.style.display = "none";
  };

  // Click: select on pointerup only when the pointer barely moved, so orbit
  // drags never count as clicks. A background click clears the selection.
  let downX = 0;
  let downY = 0;
  const onPointerDown = (event: PointerEvent) => {
    downX = event.clientX;
    downY = event.clientY;
  };
  const onPointerUp = (event: PointerEvent) => {
    if (event.button !== 0) return;
    if (Math.hypot(event.clientX - downX, event.clientY - downY) > 6) return;
    resolveHover(event);
    options.onNodeClick(hoverNode);
  };
  renderer.domElement.addEventListener("pointermove", onPointerMove);
  renderer.domElement.addEventListener("pointerleave", onPointerLeave);
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  let raf = 0;
  const animate = () => {
    raf = requestAnimationFrame(animate);
    graph.tickFrame();
    if (flyPosition && flyLookAt) {
      camera.position.lerp(flyPosition, 0.12);
      controls.target.lerp(flyLookAt, 0.12);
      if (camera.position.distanceTo(flyPosition) < 1) {
        flyPosition = null;
        flyLookAt = null;
      }
    }
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const resize = new ResizeObserver(() => {
    const w = container.clientWidth || width;
    camera.aspect = w / height;
    camera.updateProjectionMatrix();
    renderer.setSize(w, height);
  });
  resize.observe(container);

  return {
    setData(slice: ViewerSlice) {
      hoverNode = null;
      tooltip.style.display = "none";
      graph.graphData({
        nodes: slice.nodes.map((n) => ({ ...n })),
        links: slice.links.map((l) => ({ ...l })),
      });
      // An early fit once the layout has spread, plus the final fit on stop.
      window.clearTimeout(fitTimer);
      fitTimer = window.setTimeout(() => fitCamera(), 700);
    },
    setHighlight(next: ViewerHighlight | null) {
      highlight = next;
      graph.nodeColor(nodeColor());
      graph.linkColor(linkColor());
    },
    focusNode(id: string) {
      const node = graph
        .graphData()
        .nodes.find((candidate) => candidate.id === id) as
        | (ViewerNode & { x?: number; y?: number; z?: number })
        | undefined;
      if (
        !node ||
        node.x === undefined ||
        node.y === undefined ||
        node.z === undefined
      )
        return;
      const target = new THREE.Vector3(node.x, node.y, node.z);
      const distance = Math.max(
        80,
        Math.min(300, camera.position.distanceTo(controls.target) * 0.3),
      );
      const direction = camera.position
        .clone()
        .sub(controls.target)
        .normalize();
      flyLookAt = target;
      flyPosition = target.clone().add(direction.multiplyScalar(distance));
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.clearTimeout(fitTimer);
      resize.disconnect();
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("pointerleave", onPointerLeave);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      scene.remove(graph);
      renderer.dispose();
      renderer.domElement.remove();
      tooltip.remove();
    },
  };
}
