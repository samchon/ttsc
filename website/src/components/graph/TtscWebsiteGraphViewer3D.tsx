"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import type { ITtscWebsiteGraphViewer } from "../../structures/ITtscWebsiteGraphViewer";
import TtscWebsiteGraphReduce from "./TtscWebsiteGraphReduce";
import TtscWebsiteGraphViewerModel from "./TtscWebsiteGraphViewerModel";
import type { ViewerSlice } from "./TtscWebsiteGraphViewerModel";
import type { GraphScene } from "./TtscWebsiteGraphViewerScene";
import { createGraphScene } from "./TtscWebsiteGraphViewerScene";
import type { SidebarTab } from "./TtscWebsiteGraphViewerSidebar";
import TtscWebsiteGraphViewerSidebar from "./TtscWebsiteGraphViewerSidebar";

type ViewerNode = ITtscWebsiteGraphViewer.Node;
type ViewerPayload = ITtscWebsiteGraphViewer.Payload;

const {
  LINK_COLORS,
  LINK_KIND_LABEL,
  NODE_COLORS,
  edgeSummary,
  highlightOf,
  isolate,
  spotlight,
} = TtscWebsiteGraphViewerModel;

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
  { id: "excalidraw", label: "Excalidraw" },
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

const ACCENT = "#3178c6";
const HEIGHT = 560;

const panelClass =
  "overflow-hidden rounded-xl border border-[#c7dff4] bg-white shadow-[0_20px_54px_rgba(49,120,198,0.14)]";

const overlayButtonClass =
  "rounded-md border border-[#b9d5ee] bg-white/95 px-2 py-1 font-mono text-[10px] text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eaf4ff]";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TtscWebsiteGraphViewer3D({
  compact = false,
}: {
  /** Start with the explorer sidebar collapsed (for embeds on entry pages). */
  compact?: boolean;
}) {
  const [exampleId, setExampleId] = useState<string>(EXAMPLES[0]!.id);
  const [uploadName, setUploadName] = useState<string | null>(null);
  const [payload, setPayload] = useState<ViewerPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(!compact);
  const [tab, setTab] = useState<SidebarTab>("files");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isolateId, setIsolateId] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [spotKinds, setSpotKinds] = useState<Set<string>>(new Set());
  const [spotEdgeKinds, setSpotEdgeKinds] = useState<Set<string>>(new Set());

  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GraphScene | null>(null);

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
        const reduced = TtscWebsiteGraphReduce.toViewerPayload(json);
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

  // A new graph source resets the whole explorer state.
  useEffect(() => {
    setSelectedId(null);
    setIsolateId(null);
    setFile(null);
    setSpotKinds(new Set());
    setSpotEdgeKinds(new Set());
  }, [payload]);

  // The displayed slice: only the explicit isolate removes anything.
  const displayed = useMemo<ViewerSlice | null>(
    () => (payload ? isolate(payload, isolateId) : null),
    [payload, isolateId],
  );

  const selected = useMemo<ViewerNode | null>(() => {
    if (!displayed || selectedId === null) return null;
    return displayed.nodes.find((n) => n.id === selectedId) ?? null;
  }, [displayed, selectedId]);
  const selectedEdges = useMemo(
    () =>
      displayed && selectedId !== null
        ? edgeSummary(displayed.links, selectedId)
        : [],
    [displayed, selectedId],
  );

  // A filter change can remove the selected node from view; drop the selection
  // then, so the highlight never points at something invisible.
  useEffect(() => {
    if (selectedId !== null && displayed && !selected) setSelectedId(null);
  }, [selectedId, displayed, selected]);

  // Build the three.js scene once on mount; route clicks through a ref so the
  // imperative scene always sees the latest handler.
  const displayedRef = useRef<ViewerSlice | null>(null);
  const onNodeClickRef = useRef<(node: ViewerNode | null) => void>(() => {});
  onNodeClickRef.current = (node) => setSelectedId(node ? node.id : null);
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    void createGraphScene(container, {
      height: HEIGHT,
      onNodeClick: (node) => onNodeClickRef.current(node),
    })
      .then((scene) => {
        if (disposed) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        if (displayedRef.current) scene.setData(displayedRef.current);
      })
      .catch((err: unknown) => {
        if (!disposed)
          setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      disposed = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  // Push the displayed slice and the selection highlight into the scene.
  useEffect(() => {
    displayedRef.current = displayed;
    if (displayed) sceneRef.current?.setData(displayed);
  }, [displayed]);
  // A node selection outranks the file/kind/edge spotlight; both dim, never
  // remove.
  useEffect(() => {
    sceneRef.current?.setHighlight(
      displayed && selectedId !== null
        ? highlightOf(displayed.links, selectedId)
        : displayed
          ? spotlight(displayed, {
              file,
              kinds: spotKinds,
              edgeKinds: spotEdgeKinds,
            })
          : null,
    );
  }, [displayed, selectedId, file, spotKinds, spotEdgeKinds]);

  const onUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const uploaded = event.target.files?.[0];
    event.target.value = "";
    if (!uploaded) return;
    setBusy(true);
    setError(null);
    try {
      const json: unknown = JSON.parse(await uploaded.text());
      const reduced = TtscWebsiteGraphReduce.toViewerPayload(json, {
        maxNodes: 1200,
      });
      if (!reduced)
        throw new Error(
          "not a graph: expected { nodes, edges } from `ttscgraph dump`",
        );
      setPayload(reduced);
      setUploadName(uploaded.name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const pickNode = (node: ViewerNode) => {
    setSelectedId(node.id);
    sceneRef.current?.focusNode(node.id);
  };

  const filtered =
    payload !== null &&
    displayed !== null &&
    (displayed.nodes.length !== payload.nodes.length ||
      displayed.links.length !== payload.links.length);

  return (
    <div className="not-prose my-6">
      <section className={panelClass}>
        <div className="relative flex flex-wrap items-start justify-between gap-3 overflow-hidden border-b border-[#c7dff4] bg-gradient-to-b from-[#f7fbff] to-[#eef6ff] px-5 py-4">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(to right, transparent, ${ACCENT}66, transparent)`,
            }}
          />
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.22em]">
              <span style={{ color: ACCENT }}>[</span>
              <span className="mx-2 text-slate-500">Code graph</span>
              <span style={{ color: ACCENT }}>]</span>
            </p>
            <h2 className="mt-2.5 text-[17px] font-semibold tracking-tight text-[#102a43]">
              Browse a code graph in 3D
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-slate-500">
              Pick a benchmark example, or load a graph from your own project.
              Drag to orbit, scroll to zoom, click a node to focus it; the
              explorer spotlights files and finds symbols by name.
            </p>
          </div>
          {displayed && payload ? (
            <span className="shrink-0 rounded-full border border-[#b9d5ee] bg-white px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-slate-500">
              {displayed.nodes.length.toLocaleString()} nodes ·{" "}
              {displayed.links.length.toLocaleString()} edges
              {filtered
                ? ` (of ${payload.nodes.length.toLocaleString()} · ${payload.links.length.toLocaleString()})`
                : ""}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#c7dff4] bg-white px-5 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              sidebarOpen
                ? "bg-[#3178c6] text-white shadow-[0_5px_14px_rgba(49,120,198,0.22)]"
                : "text-slate-500 hover:bg-[#eaf4ff] hover:text-[#235a97]"
            }`}
            title="Toggle the file / symbol explorer"
          >
            ◫ explorer
          </button>

          <span className="mx-1 h-4 w-px bg-[#c7dff4]" />

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
                    ? "bg-[#3178c6] text-white shadow-[0_5px_14px_rgba(49,120,198,0.22)]"
                    : "text-slate-500 hover:bg-[#eaf4ff] hover:text-[#235a97]"
                }`}
                title={ex.note}
              >
                {ex.label}
              </button>
            );
          })}

          <span className="mx-1 h-4 w-px bg-[#c7dff4]" />

          <label className="cursor-pointer rounded-md border border-[#b9d5ee] bg-white px-2.5 py-1 font-mono text-[11px] text-[#235a97] transition-colors hover:border-[#3178c6] hover:bg-[#eaf4ff]">
            Load your own JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={onUpload}
            />
          </label>
          {uploadName ? (
            <span className="inline-flex items-center gap-2 rounded-md bg-[#eaf4ff] px-2.5 py-1 font-mono text-[11px] text-slate-700 ring-1 ring-inset ring-[#b9d5ee]">
              {uploadName}
              <button
                type="button"
                onClick={() => setUploadName(null)}
                className="text-slate-400 hover:text-[#235a97]"
                title="back to examples"
              >
                ×
              </button>
            </span>
          ) : null}
        </div>

        {error ? (
          <p className="border-b border-red-200 bg-red-50 px-5 py-2 font-mono text-[10px] text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex">
          {sidebarOpen && payload ? (
            <TtscWebsiteGraphViewerSidebar
              payload={payload}
              height={HEIGHT}
              tab={tab}
              onTab={setTab}
              spotKinds={spotKinds}
              onToggleKind={(kind) =>
                setSpotKinds((prev) => {
                  const next = new Set(prev);
                  if (next.has(kind)) next.delete(kind);
                  else next.add(kind);
                  return next;
                })
              }
              spotEdgeKinds={spotEdgeKinds}
              onToggleEdgeKind={(kind) =>
                setSpotEdgeKinds((prev) => {
                  const next = new Set(prev);
                  if (next.has(kind)) next.delete(kind);
                  else next.add(kind);
                  return next;
                })
              }
              file={file}
              onFile={setFile}
              onClearSpotlight={() => {
                setFile(null);
                setSpotKinds(new Set());
                setSpotEdgeKinds(new Set());
              }}
              selectedId={selectedId}
              onPickNode={pickNode}
            />
          ) : null}

          <div
            ref={containerRef}
            className="relative min-w-0 flex-1"
            style={{ height: HEIGHT }}
          >
            {!displayed ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[12px] text-slate-500">
                {busy ? "Building the graph…" : "Loading…"}
              </div>
            ) : null}

            {isolateId !== null ? (
              <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
                <span className="rounded-md border border-[#9fc7eb] bg-[#eaf4ff]/95 px-2 py-1 font-mono text-[10px] text-[#3178c6]">
                  2-hop isolate
                </span>
                <button
                  type="button"
                  className={overlayButtonClass}
                  onClick={() => setIsolateId(null)}
                >
                  show full graph
                </button>
              </div>
            ) : null}

            {selected ? (
              <div className="absolute right-3 top-3 z-20 w-72 rounded-lg border border-[#b9d5ee] bg-white/95 p-3 shadow-[0_18px_45px_rgba(49,120,198,0.18)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-[13px] font-semibold leading-snug text-[#102a43]">
                    {selected.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="shrink-0 text-slate-400 hover:text-[#235a97]"
                    title="clear selection"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-slate-500">
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{
                      background: NODE_COLORS[selected.kind] ?? "#64748b",
                    }}
                  />
                  {selected.kind} · {selected.file}
                </p>
                <div className="mt-2 space-y-1 border-t border-[#d2e4f4] pt-2 font-mono text-[10px]">
                  <p className="text-slate-500">
                    {selected.degree.toLocaleString()} connections shown
                  </p>
                  {selectedEdges.map((row) => (
                    <p
                      key={row.kind}
                      className="flex items-center gap-1.5 text-slate-700"
                    >
                      <span
                        className="inline-block h-0.5 w-3 rounded-full"
                        style={{
                          background: LINK_COLORS[row.kind] ?? "#64748b",
                        }}
                      />
                      {row.kind}
                      <span className="ml-auto tabular-nums text-slate-500">
                        → {row.out} · ← {row.in}
                      </span>
                    </p>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-2">
                  {isolateId === selected.id ? (
                    <button
                      type="button"
                      className={overlayButtonClass}
                      onClick={() => setIsolateId(null)}
                    >
                      exit isolate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={overlayButtonClass}
                      onClick={() => setIsolateId(selected.id)}
                    >
                      isolate 2 hops
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#c7dff4] bg-white px-5 py-3 font-mono text-[10px] text-slate-500">
          {Object.entries(LINK_COLORS).map(([kind, color]) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: color }}
              />
              {LINK_KIND_LABEL[kind] ?? kind}
            </span>
          ))}
          <span className="text-slate-400">
            node size = connection count · color = declaration kind
          </span>
        </div>
      </section>
    </div>
  );
}
