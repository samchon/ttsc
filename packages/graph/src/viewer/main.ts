// Vanilla 3D code-graph viewer bundled into @ttsc/graph by esbuild and served by
// `ttsc-graph view`. Mirrors website/src/components/graph/GraphViewer3D.tsx, but
// standalone (no React): fetch the reduced graph the CLI serves, render it on
// three.js + three-forcegraph, and let the user orbit it.
import * as THREE from "three";
import ThreeForceGraph from "three-forcegraph";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

interface GNode {
  id: string;
  name: string;
  kind: string;
  file: string;
  degree: number;
}

interface GLink {
  source: string;
  target: string;
  kind: string;
}

interface Payload {
  project: string;
  counts: { nodes: number; links: number };
  nodes: GNode[];
  links: GLink[];
}

const NODE_COLORS: Record<string, string> = {
  class: "#36e2ee",
  interface: "#6ea8ff",
  function: "#3fb950",
  method: "#2bb673",
  type: "#f5b042",
  enum: "#c792ea",
  variable: "#8b97a8",
};

const LINK_COLORS: Record<string, string> = {
  "value-call": "#3fb950",
  "type-ref": "#f5b042",
  "doc-ref": "#c07de0",
  heritage: "#6ea8ff",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function setText(id: string, text: string): void {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

async function main(): Promise<void> {
  const container = document.getElementById("graph");
  if (!container) return;

  let data: Payload;
  try {
    const res = await fetch("graph.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = (await res.json()) as Payload;
  } catch (err) {
    container.textContent = `could not load the graph (${String(err)})`;
    return;
  }

  if (data.project) setText("project", data.project);
  setText(
    "counts",
    `${data.nodes.length.toLocaleString()} nodes · ${data.links.length.toLocaleString()} edges`,
  );

  const width = container.clientWidth || 800;
  const height = container.clientHeight || 600;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c10);
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const keyLight = new THREE.DirectionalLight(0xffffff, 0.8);
  keyLight.position.set(1, 1, 1);
  scene.add(keyLight);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1e6);
  camera.position.set(0, 0, 320);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.18;

  const graph = new ThreeForceGraph<GNode, GLink>()
    .nodeId("id")
    .nodeRelSize(4)
    .nodeResolution(12)
    .nodeOpacity(0.95)
    .nodeVal((node) => 1 + Math.sqrt(node.degree))
    .nodeColor((node) => NODE_COLORS[node.kind] ?? "#8b97a8")
    .linkColor((link) => LINK_COLORS[link.kind] ?? "#ffffff55")
    .linkOpacity(0.4)
    .linkWidth(0)
    .warmupTicks(20)
    .cooldownTicks(160);
  scene.add(graph);

  const fit = (): void => {
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
  // `?static` settles the layout, frames it, then stops the render loop, for a
  // low-CPU snapshot (and headless screenshots). Default mode keeps animating.
  const staticMode = new URLSearchParams(window.location.search).has("static");
  let stopAtFrame = -1;
  let frame = 0;
  graph.onEngineStop(() => {
    fit();
    if (staticMode && stopAtFrame < 0) stopAtFrame = frame + 4;
  });

  // Hover tooltip via raycasting the node objects (each carries __data).
  const tooltip = document.createElement("div");
  tooltip.className = "tooltip";
  container.appendChild(tooltip);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  renderer.domElement.addEventListener("pointermove", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(graph.children, true);
    let node: GNode | null = null;
    for (const hit of hits) {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        const meta = obj as { __graphObjType?: string; __data?: unknown };
        if (meta.__graphObjType === "node" && meta.__data) {
          node = meta.__data as GNode;
          break;
        }
        obj = obj.parent;
      }
      if (node) break;
    }
    if (!node) {
      tooltip.style.display = "none";
      return;
    }
    tooltip.style.display = "block";
    tooltip.style.left = `${event.clientX - rect.left + 12}px`;
    tooltip.style.top = `${event.clientY - rect.top + 12}px`;
    tooltip.innerHTML =
      `${escapeHtml(node.name)}<br/>` +
      `<span class="muted">${escapeHtml(node.kind)} · ${escapeHtml(node.file)}</span>`;
  });
  renderer.domElement.addEventListener("pointerleave", () => {
    tooltip.style.display = "none";
  });

  const animate = (): void => {
    if (stopAtFrame >= 0 && frame > stopAtFrame) {
      renderer.render(scene, camera);
      return;
    }
    requestAnimationFrame(animate);
    graph.tickFrame();
    controls.update();
    renderer.render(scene, camera);
    frame++;
  };
  animate();

  window.addEventListener("resize", () => {
    const w = container.clientWidth || width;
    const h = container.clientHeight || height;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  graph.graphData({ nodes: data.nodes, links: data.links });
  window.setTimeout(fit, 700);
}

void main();
