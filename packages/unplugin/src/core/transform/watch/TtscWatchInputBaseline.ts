import type { TtscWatchInputFileBaseline } from "./TtscWatchInputFileBaseline";

/** Main-process state broad enough to compare every watch-input codec. */
export interface TtscWatchInputBaseline extends TtscWatchInputFileBaseline {
  /** Whether the compiler's stat classifies the path as a directory. */
  directoryExists: boolean;
  /** State hash under the `graph` evidence codec, or the missing-input marker. */
  graphHash: string;
  /**
   * Hash of the compiler-style read an observation's `readFile` predicate
   * records, or `null` when that read fails.
   */
  graphReadHash: string | null;
  /** State hash under the `host` evidence codec, or the missing-input marker. */
  hostHash: string;
  /** The compiler's realpath observation of the path. */
  realpath: { ok: false; path?: never } | { ok: true; path: string };
  /** The compiler's stat classification of the path. */
  stat: "directory" | "file" | "missing";
  /**
   * The path's state as a plugin source directory, its files and build
   * environment (`pluginSourceState`, samchon/ttsc#1487, samchon/ttsc#1493),
   * captured only for a path recorded as one, since the state reads every file
   * below it; `null` when it cannot be read.
   */
  tree?: string | null;
}
