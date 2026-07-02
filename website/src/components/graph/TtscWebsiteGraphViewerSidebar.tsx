"use client";

import { useMemo, useState } from "react";

import type { ITtscWebsiteGraphViewer } from "../../structures/ITtscWebsiteGraphViewer";
import TtscWebsiteGraphViewerModel from "./TtscWebsiteGraphViewerModel";
import type { FileTreeEntry, ViewerSlice } from "./TtscWebsiteGraphViewerModel";

type ViewerNode = ITtscWebsiteGraphViewer.Node;

export type SidebarTab = "files" | "symbols";

const { LINK_COLORS, NODE_COLORS, buildFileTree, kindsIn, searchNodes } =
  TtscWebsiteGraphViewerModel;

const rowClass =
  "flex w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-left font-mono text-[11px] transition-colors hover:bg-[#13171f]";

function Chevron({ open }: { open: boolean }) {
  return (
    <span
      className={`inline-block w-3 shrink-0 text-center text-neutral-600 transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden="true"
    >
      ›
    </span>
  );
}

function CountBadge({ count }: { count: number }) {
  return (
    <span className="ml-auto shrink-0 pl-1 text-[10px] tabular-nums text-neutral-600">
      {count.toLocaleString()}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Files tab: the directory tree of the (reduced) payload
// ---------------------------------------------------------------------------

function FileTreeRow({
  entry,
  depth,
  expanded,
  onToggle,
  file,
  onFile,
}: {
  entry: FileTreeEntry;
  depth: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
  file: string | null;
  onFile: (path: string | null) => void;
}) {
  const open = expanded.has(entry.path);
  const active = file === entry.path;
  return (
    <div>
      <button
        type="button"
        className={`${rowClass} ${
          active
            ? "bg-[#1b212c] text-neutral-50 ring-1 ring-inset ring-[#2a313e]"
            : "text-neutral-400"
        }`}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
        title={entry.path}
        onClick={() => {
          if (entry.dir) onToggle(entry.path);
          onFile(active ? null : entry.path);
        }}
      >
        {entry.dir ? (
          <Chevron open={open} />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <span className="truncate">{entry.name}</span>
        <CountBadge count={entry.count} />
      </button>
      {entry.dir && open
        ? entry.children.map((child) => (
            <FileTreeRow
              key={child.path}
              entry={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              file={file}
              onFile={onFile}
            />
          ))
        : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export default function TtscWebsiteGraphViewerSidebar({
  payload,
  height,
  tab,
  onTab,
  kinds,
  onToggleKind,
  edgeKinds,
  onToggleEdgeKind,
  file,
  onFile,
  selectedId,
  onPickNode,
}: {
  /** The full reduced payload; the tree and search always see everything. */
  payload: ViewerSlice;
  height: number;
  tab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  kinds: ReadonlySet<string>;
  onToggleKind: (kind: string) => void;
  edgeKinds: ReadonlySet<string>;
  onToggleEdgeKind: (kind: string) => void;
  file: string | null;
  onFile: (path: string | null) => void;
  selectedId: string | null;
  onPickNode: (node: ViewerNode) => void;
}) {
  const tree = useMemo(() => buildFileTree(payload.nodes), [payload]);
  const allKinds = useMemo(() => kindsIn(payload.nodes), [payload]);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(tree.filter((entry) => entry.dir).map((entry) => entry.path)),
  );
  const [query, setQuery] = useState("");
  const results = useMemo(
    () => searchNodes(payload.nodes, query),
    [payload, query],
  );

  const toggleExpanded = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <aside
      className="flex w-64 shrink-0 flex-col border-r border-[#222834] bg-[#0b0d12]"
      style={{ height }}
    >
      <div className="flex shrink-0 gap-1 border-b border-[#222834] px-2 py-1.5">
        {(["files", "symbols"] as const).map((candidate) => (
          <button
            key={candidate}
            type="button"
            onClick={() => onTab(candidate)}
            className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
              tab === candidate
                ? "bg-[#1b212c] text-neutral-50 ring-1 ring-inset ring-[#2a313e]"
                : "text-neutral-400 hover:bg-[#13171f] hover:text-neutral-100"
            }`}
          >
            {candidate === "files" ? "Files" : "Symbols"}
          </button>
        ))}
        {file !== null ? (
          <button
            type="button"
            onClick={() => onFile(null)}
            className="ml-auto rounded-md px-2 py-1 font-mono text-[10px] text-[#36e2ee] hover:bg-[#13171f]"
            title="Clear the file spotlight"
          >
            clear spotlight
          </button>
        ) : null}
      </div>

      {tab === "files" ? (
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          <p className="px-1.5 pb-1.5 font-mono text-[10px] text-neutral-600">
            files in the reduced graph; click to spotlight one in the view
          </p>
          {tree.map((entry) => (
            <FileTreeRow
              key={entry.path}
              entry={entry}
              depth={0}
              expanded={expanded}
              onToggle={toggleExpanded}
              file={file}
              onFile={onFile}
            />
          ))}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="shrink-0 p-2">
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search symbols…"
              className="w-full rounded-md border border-[#2a313e] bg-[#0c0e13] px-2 py-1.5 font-mono text-[11px] text-neutral-100 placeholder:text-neutral-600 focus:border-[#36e2ee66] focus:outline-none"
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
            {query.trim().length > 0 ? (
              results.length > 0 ? (
                results.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => onPickNode(node)}
                    className={`${rowClass} ${
                      selectedId === node.id
                        ? "bg-[#1b212c] text-neutral-50 ring-1 ring-inset ring-[#2a313e]"
                        : "text-neutral-300"
                    }`}
                    title={`${node.kind} · ${node.file}`}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-full"
                      style={{
                        background: NODE_COLORS[node.kind] ?? "#8b97a8",
                      }}
                    />
                    <span className="truncate">{node.name}</span>
                    <span className="ml-auto shrink-0 truncate pl-1 text-[10px] text-neutral-600">
                      {node.kind}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-1.5 py-2 font-mono text-[11px] text-neutral-600">
                  No symbol matched.
                </p>
              )
            ) : (
              <p className="px-1.5 py-2 font-mono text-[10px] text-neutral-600">
                Type to find a class, function, or type; picking one flies the
                camera to it.
              </p>
            )}
          </div>
          <div className="shrink-0 space-y-2 border-t border-[#222834] p-2">
            <div className="flex flex-wrap gap-1">
              {allKinds.map((kind) => {
                const on = kinds.has(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onToggleKind(kind)}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      on
                        ? "border-[#2a313e] bg-[#11151d] text-neutral-200"
                        : "border-[#1c2230] bg-transparent text-neutral-600"
                    }`}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{
                        background: on
                          ? (NODE_COLORS[kind] ?? "#8b97a8")
                          : "#3a4150",
                      }}
                    />
                    {kind}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.keys(LINK_COLORS).map((kind) => {
                const on = edgeKinds.has(kind);
                return (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => onToggleEdgeKind(kind)}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] transition-colors ${
                      on
                        ? "border-[#2a313e] bg-[#11151d] text-neutral-200"
                        : "border-[#1c2230] bg-transparent text-neutral-600"
                    }`}
                  >
                    <span
                      className="inline-block h-0.5 w-3 rounded-full"
                      style={{
                        background: on ? LINK_COLORS[kind] : "#3a4150",
                      }}
                    />
                    {kind}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}
