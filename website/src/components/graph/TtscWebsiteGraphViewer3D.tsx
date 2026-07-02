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

const ACCENT = "#36e2ee";
const HEIGHT = 560;

const panelClass =
  "overflow-hidden rounded-lg border border-[#222834] bg-[#0c0e13] shadow-[0_24px_60px_rgba(0,0,0,0.35)]";

const overlayButtonClass =
  "rounded-md border border-[#2a313e] bg-[#0c0e13ee] px-2 py-1 font-mono text-[10px] text-neutral-300 transition-colors hover:bg-[#13171f] hover:text-neutral-50";

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
              Drag to orbit, scroll to zoom, click a node to focus it; the
              explorer spotlights files and finds symbols by name.
            </p>
          </div>
          {displayed && payload ? (
            <span className="shrink-0 rounded-full border border-[#2a313e] bg-[#0c0e13] px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
              {displayed.nodes.length.toLocaleString()} nodes ·{" "}
              {displayed.links.length.toLocaleString()} edges
              {filtered
                ? ` (of ${payload.nodes.length.toLocaleString()} · ${payload.links.length.toLocaleString()})`
                : ""}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-[#222834] px-5 py-3">
          <button
            type="button"
            onClick={() => setSidebarOpen((open) => !open)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              sidebarOpen
                ? "bg-[#1b212c] text-neutral-50 ring-1 ring-inset ring-[#2a313e]"
                : "text-neutral-400 hover:bg-[#13171f] hover:text-neutral-100"
            }`}
            title="Toggle the file / symbol explorer"
          >
            ◫ explorer
          </button>

          <span className="mx-1 h-4 w-px bg-[#222834]" />

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
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-[12px] text-neutral-500">
                {busy ? "Building the graph…" : "Loading…"}
              </div>
            ) : null}

            {isolateId !== null ? (
              <div className="absolute left-3 top-3 z-20 flex items-center gap-2">
                <span className="rounded-md border border-[#1f3e46] bg-[#0d1a1dee] px-2 py-1 font-mono text-[10px] text-[#36e2ee]">
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
              <div className="absolute right-3 top-3 z-20 w-72 rounded-md border border-[#2a313e] bg-[#090b10f2] p-3 shadow-[0_18px_45px_rgba(0,0,0,0.45)]">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 break-words text-[13px] font-semibold leading-snug text-neutral-50">
                    {selected.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedId(null)}
                    className="shrink-0 text-neutral-500 hover:text-neutral-200"
                    title="clear selection"
                  >
                    ×
                  </button>
                </div>
                <p className="mt-1 break-all font-mono text-[10px] leading-relaxed text-neutral-500">
                  <span
                    className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                    style={{
                      background: NODE_COLORS[selected.kind] ?? "#8b97a8",
                    }}
                  />
                  {selected.kind} · {selected.file}
                </p>
                <div className="mt-2 space-y-1 border-t border-[#1c2230] pt-2 font-mono text-[10px]">
                  <p className="text-neutral-500">
                    {selected.degree.toLocaleString()} connections shown
                  </p>
                  {selectedEdges.map((row) => (
                    <p
                      key={row.kind}
                      className="flex items-center gap-1.5 text-neutral-300"
                    >
                      <span
                        className="inline-block h-0.5 w-3 rounded-full"
                        style={{
                          background: LINK_COLORS[row.kind] ?? "#8b97a8",
                        }}
                      />
                      {row.kind}
                      <span className="ml-auto tabular-nums text-neutral-400">
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

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[#222834] px-5 py-3 font-mono text-[10px] text-neutral-500">
          {Object.entries(LINK_COLORS).map(([kind, color]) => (
            <span key={kind} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: color }}
              />
              {LINK_KIND_LABEL[kind] ?? kind}
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
