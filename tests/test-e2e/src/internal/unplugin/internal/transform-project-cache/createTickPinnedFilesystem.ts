import fs from "node:fs";
import path from "node:path";

import { PINNED_TICK } from "./PINNED_TICK";

/**
 * Cache-owned filesystem operations whose write-mintable stamps the test
 * controls, reproducing the clock-tick collapse deterministically.
 *
 * A filesystem stamps a write once per clock tick, so a same-length rewrite
 * inside the tick that minted an input's recorded stamp leaves its metadata
 * signature unchanged. Real timing cannot pin that window reliably, so these
 * operations report one constant tick for every path (overridable per path
 * through `stamps`, for modification time alone through `modificationStamps`,
 * and for the adapter-minted probe through `reference`) while every other
 * observation remains the real filesystem's. With every stamp in one tick, the
 * observed filesystem's clock never provably leaves it, which is exactly the
 * state a freshly written tree is in on a coarse-tick filesystem.
 *
 * `watch` is a seam too: `"silent"` registers healthy watchers that never
 * report, keeping the narrow validation path live without real watcher races,
 * while `"refused"` throws so the generation validates through its recorded
 * whole-snapshot state.
 */
export function createTickPinnedFilesystem(props: {
  device: bigint;
  reads?: string[];
  watch: "refused" | "silent";
}): {
  modificationStamps: Map<string, bigint>;
  operations: Record<string, unknown>;
  reference: {
    available: boolean;
    device: bigint;
    directories: Set<string>;
    stamp: bigint;
  };
  stamps: Map<string, bigint>;
  watchers: {
    active: Set<number>;
    closed: Set<number>;
    fail: number | undefined;
    next: number;
  };
} {
  const modificationStamps = new Map<string, bigint>();
  const reference = {
    available: true,
    device: props.device,
    directories: new Set<string>(),
    stamp: PINNED_TICK,
  };
  const stamps = new Map<string, bigint>();
  const watchers = {
    active: new Set<number>(),
    closed: new Set<number>(),
    fail: undefined as number | undefined,
    next: 0,
  };
  const reported = (location: string): bigint =>
    path.basename(location) === "clock-reference"
      ? reference.stamp
      : (stamps.get(path.resolve(location)) ?? PINNED_TICK);
  const pin = (location: string, stats: fs.BigIntStats): fs.BigIntStats => {
    const clockReference = path.basename(location) === "clock-reference";
    return Object.assign(
      Object.create(Object.getPrototypeOf(stats)) as fs.BigIntStats,
      stats,
      {
        atimeNs: reported(location),
        birthtimeNs: reported(location),
        ctimeNs: reported(location),
        dev: clockReference ? reference.device : props.device,
        mtimeNs:
          modificationStamps.get(path.resolve(location)) ?? reported(location),
      },
    );
  };
  return {
    modificationStamps,
    operations: {
      lstat: (location: string) => {
        if (path.basename(location) === "clock-reference") {
          reference.directories.add(path.dirname(location));
          if (!reference.available) {
            const error = new Error(
              "clock reference observation refused",
            ) as NodeJS.ErrnoException;
            error.code = "EIO";
            throw error;
          }
        }
        return pin(location, fs.lstatSync(location, { bigint: true }));
      },
      statBigInt: (location: string) =>
        pin(location, fs.statSync(location, { bigint: true })),
      readFile: (location: string) => {
        props.reads?.push(path.resolve(location));
        return fs.readFileSync(location);
      },
      watch: () => {
        if (props.watch === "silent") {
          const watcher = watchers.next++;
          watchers.active.add(watcher);
          return {
            close: () => {
              if (!watchers.active.delete(watcher)) return;
              watchers.closed.add(watcher);
              if (watchers.fail === watcher) {
                throw new Error("forced published watcher cleanup failure");
              }
            },
          };
        }
        const error = new Error(
          "watch registration refused",
        ) as NodeJS.ErrnoException;
        error.code = "ENOSPC";
        throw error;
      },
    },
    reference,
    stamps,
    watchers,
  };
}
