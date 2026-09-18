import path from "node:path";

import type { TtscTransformFilesystemOperations } from "../../filesystem/TtscTransformFilesystemOperations";
import type { TtscProjectMutationTracker } from "../TtscProjectMutationTracker";
import { WINDOWS_PROJECT_MUTATION_BROKER } from "./WINDOWS_PROJECT_MUTATION_BROKER";
import type { WindowsMutationLocation } from "./WindowsMutationLocation";
import { drainWindowsProjectMutationBroker } from "./drainWindowsProjectMutationBroker";
import { getWindowsProjectMutationBroker } from "./getWindowsProjectMutationBroker";

/**
 * Register directory watches in an isolated Windows process.
 *
 * Node's Windows fs-event backend can assert in native code when a watched
 * temporary tree is deleted. Isolation turns that unrecoverable process abort
 * into an ordinary broker exit and a conservative cache miss in the host.
 */
export async function registerWindowsProjectMutationTracker(
  tracker: TtscProjectMutationTracker,
  locations: readonly WindowsMutationLocation[],
  allEvents: boolean,
  filesystem: TtscTransformFilesystemOperations,
  /**
   * Optional filter for the project-directory tracker, whose events have to be
   * narrowed to program membership exactly as the in-process watcher's are. The
   * name-watching trackers pass none, since they already watch exact names.
   */
  membership?: (location: string, filename: string) => boolean,
  content?: (location: string, filename: string) => boolean,
  changeAddsMembership?: (location: string, filename: string) => boolean,
): Promise<void> {
  const broker = getWindowsProjectMutationBroker();
  // The child watches canonical directories, and reports its events under that
  // spelling. Everything else in the adapter speaks the walk's own spelling,
  // which on Windows can be an 8.3 short form of the same directory, so keep
  // the way back: a filter that compared the child's spelling against the
  // configuration's would be comparing two names for one directory that share
  // no common prefix (samchon/ttsc#1307).
  const spellings = new Map<string, string>();
  const normalized = locations.map((location) => {
    let directory: string;
    try {
      directory = filesystem.realpath(location.directory);
    } catch {
      directory = path.resolve(location.directory);
    }
    spellings.set(directory, location.directory);
    return {
      directory,
      ...(location.names === undefined ? {} : { names: location.names }),
      ...(location.recursive === true ? { recursive: true } : {}),
    };
  });
  broker.pendingRegistrations += 1;
  broker.child.ref();
  // Bun's IPC channel omits Node's Control.ref/unref methods. The child itself
  // still owns the outstanding acknowledgement on that runtime.
  broker.child.channel?.ref?.();
  const id = broker.nextId++;
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  broker.trackers.set(id, {
    ...(changeAddsMembership === undefined ? {} : { changeAddsMembership }),
    ...(content === undefined ? {} : { content }),
    ...(membership === undefined ? {} : { membership }),
    ready: resolveReady,
    spellings,
    tracker,
  });
  tracker.drain = () => drainWindowsProjectMutationBroker(broker);
  tracker.close = () => {
    tracker.failed = true;
    const active = broker.trackers.get(id);
    if (active === undefined) return;
    broker.trackers.delete(id);
    active.ready();
    let failed = false;
    let failure: unknown;
    try {
      broker.child.send?.({ id, op: "remove" });
    } catch (error) {
      failed = true;
      failure = error;
    }
    if (broker.trackers.size === 0) {
      if (WINDOWS_PROJECT_MUTATION_BROKER.current === broker) {
        WINDOWS_PROJECT_MUTATION_BROKER.current = undefined;
      }
      try {
        broker.child.disconnect?.();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
      try {
        broker.child.kill();
      } catch (error) {
        if (!failed) {
          failed = true;
          failure = error;
        }
      }
    }
    if (failed) throw failure;
  };
  broker.child.send?.({
    allEvents,
    locations: normalized,
    id,
    op: "add",
  });
  try {
    await ready;
  } finally {
    broker.pendingRegistrations -= 1;
    // `ref`/`unref` is a flag rather than a counter, so this must not clear a
    // reference an in-flight acknowledgement is holding: a delivery waiting on
    // a reply over an unreferenced channel lets the loop empty and the process
    // exit mid-build.
    if (broker.pendingRegistrations === 0 && broker.pendingDrains === 0) {
      broker.child.unref();
      broker.child.channel?.unref?.();
    }
  }
}
