"use client";

import type { ChangeEvent } from "react";
import { useEffect, useRef, useState } from "react";

import {
  toViewerPayload,
  type ViewerLink,
  type ViewerNode,
  type ViewerPayload,
} from "./graphReduce";

// ---------------------------------------------------------------------------
// Examples — the benchmark fixtures graphed under /graph. vscode leads.
// ---------------------------------------------------------------------------

interface Example {
  id: string;
  label: string;
  note?: string;
}

const EXAMPLES: Example[] = [
  { id: "vscode", label: "VS Code", note: "6,093 files" },
  { id: "typeorm", label: "TypeORM" },
  { id: "vue", label: "Vue" },
  { id: "nestjs", label: "NestJS" },
  { id: "rxjs", label: "RxJS" },
  { id: "zod", label: "Zod" },
  { id: "shopping-backend", label: "shopping-backend" },
];

// ---------------------------------------------------------------------------
// Style tokens (shared with the benchmark components)
// ---------------------------------------------------------------------------

const ACCENT = "#36e2ee";
const HEIGHT = 560;

const panelClass =
  "overflow-hidden rounded-lg border border-[#222834] bg-[#0c0e13] shadow-[0_24px_60px_rgba(0,0,0,0.35)]";

const NODE_COLORS: Record<string, string> = {
  class: ACCENT,
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
  heritage: "#6ea8ff",
};

const KIND_LABEL: Record<string, string> = {
  "value-call": "value-call (runtime use)",
  "type-ref": "type-ref",
  heritage: "heritage (extends / implements)",
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// A handle the React shell uses to push data / tear down the imperative
// three.js scene built once on mount.
interface SceneHandle {
  setData: (payload: ViewerPayload) => void;
  dispose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="not-prose my-6 rounded-lg border border-[#222834] bg-[#0c0e13] px-4 py-3 font-mono text-[12px] text-neutral-400">
      {children}
    </p>
  );
}

export default function GraphViewer3D() {
  const [exampleId, setExampleId] = useState<string>(EXAMPLES[0]!.id);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<SceneHandle | null>(null);
  const payloadRef = useRef<ViewerPayload | null>(null);

  // Load the selected example whenever it changes and no upload is active.
  useEffect(() => {
    if (uploadName) return;
    let cancelled = false;
    setBusy(true);
    setError(null);
    fetch(`/graph/${exampleId}.json`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: unknown) => {
        if (cancelled) return;
        const reduced = toViewerPayload(json);
        if (!reduced) throw new Error("unrecognized graph JSON shape");
        setPayload(reduced);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exampleId, uploadName]);

  // Build the three.js scene once on mount. Every rendering import is dynamic so
  // nothing touches `window` during static export.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;

    void (async () => {
      const THREE = await import("three");
      const { OrbitControls } = await import(
        "three/examples/jsm/controls/OrbitControls.js"
      );
      const ThreeForceGraph = (await import("three-forcegraph")).default;
      if (disposed) return;

      const width = container.clientWidth || 800;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0a0c10);
      scene.add(new THREE.AmbientLight(0xffffff, 2));
      const key = new THREE.DirectionalLight(0xffffff, 0.8);
      key.position.set(1, 1, 1);
      scene.add(key);

      const camera = new THREE.PerspectiveCamera(50, width / HEIGHT, 0.1, 1e6);
      camera.position.set(0, 0, 320);

      const renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, HEIGHT);
      container.appendChild(renderer.domElement);

      const controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.18;

      const graph = new ThreeForceGraph<ViewerNode, ViewerLink>()
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

      // Hover: raycast the node objects (each carries __data) for a tooltip.
      const tooltip = document.createElement("div");
      tooltip.style.cssText =
        "position:absolute;display:none;pointer-events:none;z-index:10;max-width:22rem;padding:4px 7px;border-radius:6px;background:#0c0e13ee;border:1px solid #2a313e;font:11px ui-monospace,monospace;color:#e6edf3";
      container.appendChild(tooltip);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let hoverNode: ViewerNode | null = null;
      const onPointerMove = (event: PointerEvent) => {
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
        if (!hoverNode) {
          tooltip.style.display = "none";
          return;
        }
        tooltip.style.display = "block";
        tooltip.style.left = `${event.clientX - rect.left + 12}px`;
        tooltip.style.top = `${event.clientY - rect.top + 12}px`;
        tooltip.innerHTML =
          `${escapeHtml(hoverNode.name)}<br/>` +
          `<span style="color:#8b97a8">${escapeHtml(hoverNode.kind)} · ${escapeHtml(hoverNode.file)}</span>`;
      };
      const onPointerLeave = () => {
        hoverNode = null;
        tooltip.style.display = "none";
      };
      renderer.domElement.addEventListener("pointermove", onPointerMove);
      renderer.domElement.addEventListener("pointerleave", onPointerLeave);

      let raf = 0;
      const animate = () => {
        raf = requestAnimationFrame(animate);
        graph.tickFrame();
        controls.update();
        renderer.render(scene, camera);
      };
      animate();

      const resize = new ResizeObserver(() => {
        const w = container.clientWidth || width;
        camera.aspect = w / HEIGHT;
        camera.updateProjectionMatrix();
        renderer.setSize(w, HEIGHT);
      });
      resize.observe(container);

      const setData = (next: ViewerPayload) => {
        graph.graphData({
          nodes: next.nodes.map((n) => ({ ...n })),
          links: next.links.map((l) => ({ ...l })),
        });
        // An early fit once the layout has spread, plus the final fit on stop.
        window.clearTimeout(fitTimer);
        fitTimer = window.setTimeout(() => {
          if (!disposed) fitCamera();
        }, 700);
      };

      sceneRef.current = {
        setData,
        dispose: () => {
          cancelAnimationFrame(raf);
          window.clearTimeout(fitTimer);
          resize.disconnect();
          renderer.domElement.removeEventListener("pointermove", onPointerMove);
          renderer.domElement.removeEventListener(
            "pointerleave",
            onPointerLeave,
          );
          controls.dispose();
          scene.remove(graph);
          renderer.dispose();
          renderer.domElement.remove();
          tooltip.remove();
        },
      };

      if (payloadRef.current) setData(payloadRef.current);
    })().catch((err: unknown) => {
      if (!disposed)
        setError(err instanceof Error ? err.message : String(err));
    });

    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Push new data into the scene whenever the payload changes.
  useEffect(() => {
    payloadRef.current = payload;
    if (payload) sceneRef.current?.setData(payload);
  }, [payload]);

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const json: unknown = JSON.parse(await file.text());
      const reduced = toViewerPayload(json, { maxNodes: 1200 });
      if (!reduced)
        throw new Error(
          "not a graph: expected { nodes, edges } from `ttscgraph dump`",
        );
      setPayload(reduced);
      setUploadName(file.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const counts = payload?.counts;

  return (
    <div className="not-prose my-6">
      <section className={panelClass}>
        <div className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[#222834] bg-gradient-to-b from-[#13171f] to-[#0e1116] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(to right, transparent, ${ACCENT}66, transparent)`,
            }}
          />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]">
              <span style={{ color: ACCENT }}>[</span>
              <span className="mx-2 text-neutral-400">Code graph</span>
              <span style={{ color: ACCENT }}>]</span>
            </p>
            <h2 className="mt-2.5 text-[17px] font-semibold tracking-tight text-neutral-50">
              Browse a code graph in 3D
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-neutral-400">
              Pick a benchmark example, or load a graph from your own project.
              Every node is a declaration; every edge is the compiler's own
              answer. Drag to orbit, scroll to zoom.
            </p>
          </div>
          {counts ? (
            <span className="shrink-0 rounded-full border border-[#2a313e] bg-[#0c0e13] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {counts.nodes.toLocaleString()} nodes ·{" "}
              {counts.links.toLocaleString()} edges
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#222834] px-5 py-3">
          {EXAMPLES.map((ex) => {
            const active = !uploadName && ex.id === exampleId;
            return (
              <button
                key={ex.id}
                type="button"
                onClick={() => {
                  setUploadName(null);
                  setExampleId(ex.id);
                }}
                className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                  active
                    ? "bg-[#1b212c] text-neutral-50 ring-1 ring-inset ring-[#2a313e]"
                    : "text-neutral-400 hover:bg-[#13171f] hover:text-neutral-100"
                }`}
                title={ex.note}
              >
                {ex.label}
              </button>
            );
          })}

          <span className="mx-1 h-4 w-px bg-[#222834]" />

          <label className="cursor-pointer rounded-md border border-[#2a313e] bg-[#0c0e13] px-2.5 py-1 font-mono text-[11px] text-neutral-300 transition-colors hover:bg-[#13171f] hover:text-neutral-50">
            Load your own JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onUpload}
            />
          </label>
          {uploadName ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-[#1b212c] px-2.5 py-1 font-mono text-[11px] text-neutral-200 ring-1 ring-inset ring-[#2a313e]">
              {uploadName}
              <button
                type="button"
                onClick={() => setUploadName(null)}
                className="text-neutral-500 hover:text-neutral-200"
                title="back to examples"
              >
                ×
              </button>
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="border-b border-[#222834] bg-[#1a0f0f] px-5 py-2 font-mono text-[10px] text-rose-300/90">
            {error}
          </p>
        ) : null}

        <div
          ref={containerRef}
          className="relative"
          style={{ height: HEIGHT }}
        >
          {!payload ? (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[12px] text-neutral-500">
              {busy ? "Building the graph…" : "Loading…"}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#222834] px-5 py-3 font-mono text-[10px] text-neutral-500">
          {Object.entries(LINK_COLORS).map(([kind, color]) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: color }}
              />
              {KIND_LABEL[kind] ?? kind}
            </span>
          ))}
          <span className="text-neutral-600">
            node size = connection count · color = declaration kind
          </span>
        </div>
      </section>
    </div>
  );
}
