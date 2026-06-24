"use client";

import dynamic from "next/dynamic";
import type { ChangeEvent, ComponentType } from "react";
import { useEffect, useRef, useState } from "react";

import {
  type ViewerNode,
  type ViewerPayload,
  toViewerPayload,
} from "./graphReduce";

// react-force-graph-3d builds a three.js WebGL scene and touches `window` on
// import, so it must never run during static export. Load it client-only.
const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
}) as unknown as ComponentType<ForceProps>;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FNode = ViewerNode & { x?: number; y?: number; z?: number };
type FLink = { source: string | FNode; target: string | FNode; kind: string };

interface ForceProps {
  graphData: { nodes: FNode[]; links: FLink[] };
  width?: number;
  height?: number;
  backgroundColor?: string;
  nodeLabel?: (node: FNode) => string;
  nodeColor?: (node: FNode) => string;
  nodeVal?: (node: FNode) => number;
  nodeOpacity?: number;
  nodeRelSize?: number;
  linkColor?: (link: FLink) => string;
  linkWidth?: number | ((link: FLink) => number);
  linkOpacity?: number;
  enableNodeDrag?: boolean;
  showNavInfo?: boolean;
  cooldownTicks?: number;
  warmupTicks?: number;
}

interface Example {
  id: string;
  label: string;
  note?: string;
}

// The benchmark fixtures, graphed and published under /graph by
// experimental/graph-bench/viewer.mjs. vscode leads as the flagship.
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

function clone(payload: ViewerPayload): { nodes: FNode[]; links: FLink[] } {
  return {
    nodes: payload.nodes.map((n) => ({ ...n })),
    links: payload.links.map((l) => ({ ...l })),
  };
}

export default function GraphViewer3D() {
  const [exampleId, setExampleId] = useState<string>(EXAMPLES[0]!.id);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

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

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setWidth(el.clientWidth);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow re-uploading the same file
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

  const clearUpload = () => {
    setUploadName(null); // re-triggers the example effect
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

        {/* Controls: example pills + upload-your-own */}
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
                onClick={clearUpload}
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

        <div ref={containerRef} className="relative" style={{ height: HEIGHT }}>
          {width > 0 && payload ? (
            <ForceGraph3D
              graphData={clone(payload)}
              width={width}
              height={HEIGHT}
              backgroundColor="#0a0c10"
              nodeRelSize={4}
              nodeOpacity={0.95}
              nodeVal={(node) => 1 + Math.sqrt(node.degree)}
              nodeColor={(node) => NODE_COLORS[node.kind] ?? "#8b97a8"}
              nodeLabel={(node) =>
                `<div style="font:11px ui-monospace,monospace;color:#e6edf3">` +
                `${escapeHtml(node.name)}<br/>` +
                `<span style="color:#8b97a8">${escapeHtml(node.kind)} · ${escapeHtml(node.file)}</span>` +
                `</div>`
              }
              linkColor={(link) => LINK_COLORS[link.kind] ?? "#ffffff55"}
              linkWidth={0.6}
              linkOpacity={0.5}
              enableNodeDrag={false}
              showNavInfo={false}
              cooldownTicks={120}
            />
          ) : (
            <div className="flex h-full items-center justify-center font-mono text-[12px] text-neutral-500">
              {busy ? "Building the graph…" : "Loading…"}
            </div>
          )}
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
