"use client";

import TtscWebsiteBenchmarkGraphSearchParam from "./TtscWebsiteBenchmarkGraphSearchParam";

interface ReductionTab {
  id: string;
  label: string;
  meta?: string;
}

export default function TtscWebsiteBenchmarkGraphTabs({
  label,
  items,
  active,
  onSelect,
  queryParam,
}: {
  label: string;
  items: ReductionTab[];
  active: string;
  onSelect: (id: string) => void;
  queryParam: string;
}) {
  if (items.length <= 1) return null;
  return (
    <div className="grid gap-2 rounded-xl border border-[#c7dff4] bg-white p-2.5 shadow-[0_8px_24px_rgba(49,120,198,0.08)] sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:items-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>
      <nav className="flex min-w-0 gap-1 overflow-x-auto">
        {items.map((item) => {
          const selected = item.id === active;
          return (
            <a
              key={item.id}
              href={TtscWebsiteBenchmarkGraphSearchParam.href(
                queryParam,
                item.id,
              )}
              aria-current={selected ? "page" : undefined}
              className={`shrink-0 rounded-md px-3 py-1.5 text-left text-[12px] font-medium no-underline transition-colors hover:no-underline ${
                selected
                  ? "bg-[#3178c6] text-white shadow-[0_5px_14px_rgba(49,120,198,0.24)]"
                  : "text-slate-500 hover:bg-[#eaf4ff] hover:text-[#235a97]"
              }`}
              onClick={(event) => {
                event.preventDefault();
                TtscWebsiteBenchmarkGraphSearchParam.write(queryParam, item.id);
                onSelect(item.id);
              }}
            >
              <span className="block max-w-[13rem] truncate">{item.label}</span>
              {item.meta ? (
                <span
                  className={`mt-0.5 block font-mono text-[10px] ${
                    selected ? "text-blue-100" : "text-slate-400"
                  }`}
                >
                  {item.meta}
                </span>
              ) : null}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
