import type { TtscWatchInput } from "../transform/watch/TtscWatchInput";
import type { TtscWatchInputKind } from "../transform/watch/TtscWatchInputKind";
import { classifyWatchInput } from "../transform/watch/classifyWatchInput";
import type { HostWatchBridge } from "./HostWatchBridge";

/**
 * Hand one module's compiler inputs to a build host, each through the channel
 * that observes the predicate the compiler recorded for it
 * (samchon/ttsc#1388).
 *
 * The host's own channels come first:
 *
 * - Webpack and Rspack loaders: `addDependency` for a file,
 *   `addMissingDependency` for a path whose creation matters, and
 *   `addContextDependency` for a directory listing. The Turbopack loader passes
 *   `addDependency` as its missing channel, since its `addMissingDependency`
 *   does not observe a creation.
 * - Rollup, Rolldown, and Farm: `addWatchFile` for each of them.
 *
 * During a watching session, the kinds in `bridge.kinds` go to the bridge
 * instead, which observes them precisely and signals through the importer's
 * sentinel, registered on the host's file channel. Measured on the pinned
 * hosts, the caller passes:
 *
 * - Rolldown and Farm: missing paths and listings, since their `addWatchFile`
 *   reports neither a creation nor a new entry.
 * - Webpack, Rspack, and Turbopack: listings, since their directory channel is
 *   recursive. It reacts to any write below the directory, and the compiler
 *   lists the project root, output directory included. Under `next dev`,
 *   Turbopack re-ran the loader hundreds of times per change.
 * - Rollup: everything, since it opens one watcher per registered path, and
 *   watches a directory recursively.
 *
 * A webpack or Rspack watcher can also be configured to skip paths, and Rspack
 * skips `node_modules` by default. An input the host skips keeps its channel,
 * so the host's cache snapshots still record it, and goes to the bridge as
 * well, which is what observes it.
 *
 * A directory observed only to exist is never registered. The compiler consults
 * it to gate descendant probes, and each of those is registered in its own
 * right. The project's root-file membership is registered only with a bridge
 * (samchon/ttsc#1419).
 */
export function registerBuildWatchInputs(props: {
  /** The host's own file channel. */
  addWatchFile: (input: string) => void;
  /**
   * The session's bridge and the kinds it takes, present only while the host is
   * watching.
   */
  bridge?: {
    /**
     * Whether the host's own watcher skips a path. An input there is handed to
     * the bridge as well as to the host's channel. See `hostWatchIgnores`.
     */
    ignores?: (file: string) => boolean;
    instance: HostWatchBridge;
    kinds: ReadonlySet<TtscWatchInputKind>;
    startedAt: number;
  };
  /** Whether a failed delivery registers its recovery inputs. */
  failed?: boolean;
  /** The transformed module. */
  file: string;
  /** The module's derived compiler inputs, or a failed delivery's recovery. */
  inputs: readonly TtscWatchInput[];
  /** A webpack, Rspack, or Turbopack loader's typed channels. */
  loader?: {
    addContextDependency(input: string): void;
    addDependency(input: string): void;
    addMissingDependency(input: string): void;
  };
}): void {
  const bridged: TtscWatchInput[] = [];
  const addFile =
    props.loader?.addDependency.bind(props.loader) ?? props.addWatchFile;
  for (const input of props.inputs) {
    const kind = classifyWatchInput(input);
    if (kind === "presence") continue;
    if (props.bridge?.kinds.has(kind) === true) {
      bridged.push(input);
      continue;
    }
    // Only a bridge observes the project's root files. A one-shot host's
    // directory channel is recursive, so handing it the project's directories
    // would invalidate every module on any edit below them.
    if (kind === "membership") continue;
    // A path the host's watcher skips still goes to its channel, which keeps
    // it in the host's cache snapshots, and to the bridge, which observes it.
    if (props.bridge?.ignores?.(input.file) === true) bridged.push(input);
    if (props.loader === undefined) props.addWatchFile(input.file);
    else if (kind === "file") props.loader.addDependency(input.file);
    else if (kind === "missing") props.loader.addMissingDependency(input.file);
    else props.loader.addContextDependency(input.file);
  }
  // Registering an empty set still replaces the importer's earlier inputs;
  // only an importer the bridge observes needs its sentinel watched.
  const sentinel = props.bridge?.instance.register(
    props.file,
    bridged,
    props.failed,
    props.bridge.startedAt,
  );
  if (sentinel !== undefined) addFile(sentinel);
}
