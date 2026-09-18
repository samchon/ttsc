import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/** Main-process state broad enough to compare every watch-input codec. */
export interface TtscWatchInputBaseline extends TtscWatchInputFileBaseline {
  directoryExists: boolean;
  graphHash: string;
  graphReadHash: string | null;
  hostHash: string;
  realpath: { ok: false; path?: never } | { ok: true; path: string };
  stat: "directory" | "file" | "missing";
}
