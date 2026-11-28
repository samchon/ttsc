import fs from "node:fs";
import path from "node:path";

import { PROJECT_RECORD_DIRECTORY } from "./PROJECT_RECORD_DIRECTORY";

/**
 * Qualify the generated user-state record path without following its managed
 * components. The record directory must support listing, writing and traversal.
 * When it is missing, the deepest existing parent must support creation and
 * traversal. Creation mode acquires each missing component.
 *
 * @evidence contracts/common.md#principled-implementation Checks the physical temporary parent and each managed component in order before descending into it.
 * @evidence contracts/common.md#clear-and-simple-design The adapter's read-only probe and record acquisition share one path walk.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Linked or nonowned directories never qualify as record storage, even if the final name already exists.
 * @evidence contracts/common.md#meaningful-documentation Documents the probe and creation modes and which components they own.
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath and lstat distinguish junctions and symbolic links. Ownership and privacy bits are required where a uid is available.
 * @evidence contracts/performance.md#efficient-algorithms Walks four managed components with native metadata operations and no directory enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work The filesystem is observed afresh at probe and acquisition.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No handle or state is retained. Created directories belong to the record store.
 */
export function fallbackRecordStorage(
  directory: string,
  create: boolean,
): boolean | undefined {
  const state = inspect(directory, create ? "create" : "probe");
  return state === undefined ? undefined : state !== "blocked";
}

/**
 * Classify the managed ancestry before startup opens a directory inventory. A
 * readable, private directory can be inventoried before it proves writable.
 *
 * @evidence contracts/common.md#principled-implementation Ordered checks distinguish absent descendants from unsafe or inaccessible ancestors.
 * @evidence contracts/common.md#clear-and-simple-design The inventory and writer share the native ancestry walk.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts An alias or non-directory blocks descent before enumeration, even if its target is absent.
 * @evidence contracts/common.md#meaningful-documentation The comment explains why inventory requires read access separately from writes.
 * @evidence contracts/portability.md#os-neutral-implementation Native lstat checks each managed component and applies uid and privacy checks when supported.
 * @evidence contracts/performance.md#efficient-algorithms A bounded ancestry walk requires no native enumeration.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each startup observes current ancestry.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources No path observations or handles survive the call.
 */
export namespace fallbackRecordStorage {
  /** Report whether the inventory can be read without crossing unsafe ancestry. */
  export function inventory(
    directory: string,
  ): "present" | "missing" | "blocked" {
    return inspect(directory, "inventory") ?? "blocked";
  }
}

/** Walk ordinary managed components from the physical temporary parent. */
function inspect(
  directory: string,
  mode: "create" | "probe" | "inventory",
): "present" | "missing" | "blocked" | undefined {
  const tool = path.dirname(directory);
  const hosts = path.dirname(tool);
  const state = path.dirname(hosts);
  const temporary = path.dirname(state);
  const user = process.getuid?.();
  if (
    path.basename(directory) !== PROJECT_RECORD_DIRECTORY ||
    !/^[0-9a-f]{32}$/.test(path.basename(tool)) ||
    path.basename(hosts) !== "hosts" ||
    path.basename(state) !==
      `ttsc-unplugin-sessions${user === undefined ? "" : `-${user}`}`
  )
    return undefined;
  try {
    if (fs.realpathSync.native(temporary) !== temporary) return "blocked";
    let prior = temporary;
    for (const component of [state, hosts, tool, directory]) {
      let stat = fs.lstatSync(component, { throwIfNoEntry: false });
      if (stat === undefined) {
        if (mode !== "create") {
          if (mode === "probe")
            fs.accessSync(prior, fs.constants.W_OK | fs.constants.X_OK);
          return "missing";
        }
        try {
          fs.mkdirSync(component, { mode: 0o700 });
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
        stat = fs.lstatSync(component);
      }
      if (
        !stat.isDirectory() ||
        (user !== undefined && (stat.uid !== user || (stat.mode & 0o077) !== 0))
      )
        return "blocked";
      prior = component;
    }
    fs.accessSync(
      prior,
      fs.constants.R_OK |
        fs.constants.X_OK |
        (mode === "inventory" ? 0 : fs.constants.W_OK),
    );
    return "present";
  } catch {
    return "blocked";
  }
}
