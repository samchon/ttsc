import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../../internal/pathIdentity/createFilesystemPathIdentityContext";
import type { OwningModuleOptions } from "./OwningModuleOptions";

/**
 * Generations of the ttsx dependency cache: immutable emit directories and the
 * marker that publishes one of them.
 *
 * A dependency build never writes into a directory another process may be
 * reading. It writes a fresh `gen-<id>` directory and only then swaps the
 * marker, so readers across processes see either a complete old generation or a
 * complete new one.
 */
export namespace DependencyBuildGeneration {
  /** One built dependency project, as the runtime serves files from it. */
  export interface BuiltProject {
    /** The generation directory holding the project's emitted JavaScript. */
    emitDir: string;
    /** Physical source root the emit mirrors below `emitDir`. */
    rootDir: string;
    /** The build's record of its outputs, relative to `emitDir`. */
    outputs: readonly string[];
    /** The project's `module` and `target`, deciding each file's format. */
    moduleOptions: OwningModuleOptions;
  }

  /**
   * On-disk completion marker for a built dependency, shared across processes.
   *
   * `generation` names the exact immutable emit directory this marker describes
   * (`<cacheDir>/gen-<generation>`). Binding metadata to one generation is what
   * makes publication atomic: a reader that parses this marker reads the emit
   * of the SAME generation, never old metadata combined with a different, still
   * partially-written directory. The marker is the last thing a build writes,
   * and it is written by an atomic temp-and-rename, so a reader observes either
   * one complete old generation or one complete new generation.
   */
  export interface DependencyCacheMeta {
    /** The 128-bit hex id of the published generation directory. */
    generation: string;
    /** Physical source root of the built project. */
    rootDir: string;
    /**
     * The project's emit-format options. Always written; a marker without it
     * predates the field and is rebuilt rather than guessed.
     */
    moduleOptions?: OwningModuleOptions;
    /**
     * The build's record of the JavaScript it emitted, relative to the
     * generation directory. Always written; a marker without it predates the
     * field and is rebuilt, because ownership is decided against it.
     */
    outputs?: readonly string[];
  }

  /** The immutable emit directory of one build generation under `cacheDir`. */
  export function dependencyGenerationDir(
    cacheDir: string,
    generation: string,
  ): string {
    return path.join(cacheDir, `gen-${generation}`);
  }

  /** A fresh 128-bit build-generation identifier. */
  export function newDependencyGeneration(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /** True for a well-formed 128-bit hex build generation. */
  export function isDependencyGeneration(value: unknown): value is string {
    return typeof value === "string" && /^[0-9a-f]{32}$/.test(value);
  }

  /**
   * The physical spelling of a path, produced the way the served sources it
   * will be compared against are produced.
   *
   * `createFilesystemPathIdentityContext` is the same resolver the entry lane
   * uses (`prepareExecution.ts::resolveRuntimeSourceRoot`). For a path that
   * exists it is one `realpathSync.native`. For one that does not it resolves
   * as far as the filesystem goes and folds the missing tail by the case
   * semantics of the surviving ancestor, which costs a directory read and, on
   * Windows, can cost an `fsutil` query — worth knowing, but off the path a
   * real dependency root takes.
   *
   * Total on purpose. `throwOnRealpathError: false` silences a failed realpath,
   * but the case-sensitivity probe can still fail on its own (an unreadable
   * ancestor, a denied alternate-case `lstat`), and neither caller has anywhere
   * to put that: `readDependencyCache` is contracted to answer `null` rather
   * than throw, and `buildDependency` has already produced its emit. The
   * unresolved spelling is exactly what both had before this pass, so it is the
   * fallback.
   */
  export function resolvePhysicalPath(location: string): string {
    try {
      return createFilesystemPathIdentityContext({
        throwOnRealpathError: false,
      }).resolve(location).path;
    } catch {
      return location;
    }
  }

  /**
   * True when `directory` holds at least one emitted JavaScript file (any
   * depth).
   */
  export function emittedAnything(directory: string): boolean {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (emittedAnything(full)) {
          return true;
        }
      } else if (entry.isFile() && /\.(?:[cm]?js)$/i.test(entry.name)) {
        return true;
      }
    }
    return false;
  }
}
