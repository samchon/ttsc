import fs from "node:fs";
import path from "node:path";

import { createFilesystemPathIdentityContext } from "../../../internal/pathIdentity/createFilesystemPathIdentityContext";
import { outputText } from "../outputText";
import { resolveTsgo } from "../resolveTsgo";
import { spawnNative } from "../spawnNative";
import { readJsoncFile } from "./readJsoncFile";

/**
 * The project that owns `file`: the discovered `tsconfig` itself, or the
 * project it references that contains the file.
 *
 * A solution-style config (`"files": []` plus `references`) owns no files; it
 * delegates them. Vite, Nx, and many monorepo templates generate that layout,
 * and a runner that stops at the nearest config compiles the file with the
 * solution's empty options while the editor, which follows the references,
 * shows no error (samchon/ttsc#1406). This applies the language service's rule
 * for choosing a file's project:
 *
 * 1. A config that declares no `references` owns the file. Nothing is spawned, so
 *    an ordinary project pays nothing for this.
 * 2. Otherwise, the config owns the file when its own root files contain it.
 * 3. Otherwise, each reference in declaration order: a referenced config that
 *    contains the file owns it; one that does not is searched through its own
 *    references, depth-first. A reference names a config file or a directory
 *    holding `tsconfig.json`, and a cycle is visited once.
 * 4. When no project contains the file, the discovered config is kept, so the file
 *    takes the same out-of-`include` lane it always did.
 *
 * Containment is the compiler's own answer, not a reimplementation of
 * `include`/`exclude` matching: `--showConfig` lists the root files a config
 * expands to, and each is compared with the file by filesystem identity.
 * `references` are read from the config itself, because TypeScript never
 * inherits them through `extends`.
 *
 * @param props.tsconfig - The config project discovery found for the file.
 * @param props.file - The file whose project is asked for.
 * @param props.binary - An explicit TypeScript-Go binary, when one was given.
 * @param props.onConfig - Called with every config this reads, so a caller that
 *   fingerprints its inputs can record them.
 */
export function resolveOwningProjectConfig(props: {
  tsconfig: string;
  file: string;
  binary?: string;
  onConfig?: (config: string) => void;
}): string {
  const discovered = path.resolve(props.tsconfig);
  if (readReferences(discovered, props.onConfig).length === 0) {
    return discovered;
  }
  const identities = createFilesystemPathIdentityContext({
    throwOnRealpathError: false,
  });
  const target = identities.resolve(path.resolve(props.file)).key;
  const listed = (roots: RootFiles): boolean =>
    roots.files.some((root) => identities.resolve(root).key === target);
  const contains = (config: string): boolean => {
    const roots = rootFiles(config, props.binary);
    if (listed(roots)) return true;
    // A file created after the list was taken cannot be in it, and a running
    // program does write the sources it then loads. Only such a file asks the
    // compiler again, so a file that simply belongs elsewhere costs nothing.
    return (
      createdSince(props.file, roots.takenAt) &&
      listed(rootFiles(config, props.binary, true))
    );
  };
  if (contains(discovered)) {
    return discovered;
  }
  const seen = new Set<string>([identities.resolve(discovered).key]);
  const search = (config: string): string | null => {
    for (const reference of readReferences(config, props.onConfig)) {
      const key = identities.resolve(reference).key;
      if (seen.has(key)) continue;
      seen.add(key);
      if (contains(reference)) return reference;
      const nested = search(reference);
      if (nested !== null) return nested;
    }
    return null;
  };
  return search(discovered) ?? discovered;
}

/**
 * The config files `config` references, resolved, in declaration order. A
 * reference that names nothing on disk is skipped, as the compiler reports it
 * on its own.
 */
function readReferences(
  config: string,
  onConfig: ((config: string) => void) | undefined,
): string[] {
  onConfig?.(config);
  let parsed: unknown;
  try {
    parsed = readJsoncFile(config);
  } catch {
    return [];
  }
  const references = (parsed as { references?: unknown }).references;
  if (!Array.isArray(references)) return [];
  const out: string[] = [];
  for (const reference of references) {
    const spelled = (reference as { path?: unknown } | null)?.path;
    if (typeof spelled !== "string") continue;
    const target = path.resolve(path.dirname(config), spelled);
    const file = isDirectory(target)
      ? path.join(target, "tsconfig.json")
      : target;
    if (isFile(file)) out.push(file);
  }
  return out;
}

/** The root files of one config, and when the compiler was asked for them. */
interface RootFiles {
  /** Absolute paths, as the compiler listed them. */
  files: readonly string[];
  /** `Date.now()` just before the compiler was asked. */
  takenAt: number;
}

/**
 * The root files `config` expands to, as the compiler reports them. An empty
 * list when the compiler cannot load the config, which then owns nothing.
 *
 * @param refresh - Ask the compiler again instead of answering from the cache.
 */
function rootFiles(
  config: string,
  binary: string | undefined,
  refresh: boolean = false,
): RootFiles {
  const cached = rootFilesCache.get(config);
  if (cached !== undefined && !refresh) return cached;
  const takenAt = Date.now();
  let files: string[] = [];
  try {
    const directory = path.dirname(config);
    const tsgo = resolveTsgo({ binary, cwd: directory });
    const result = spawnNative(tsgo.binary, ["-p", config, "--showConfig"], {
      cwd: directory,
      encoding: "utf8",
    });
    if (result.status === 0) {
      const shown = JSON.parse(outputText(result.stdout)) as {
        files?: unknown;
      };
      if (Array.isArray(shown.files)) {
        files = shown.files
          .filter((file): file is string => typeof file === "string")
          .map((file) => path.resolve(directory, file));
      }
    }
  } catch {
    files = [];
  }
  const roots = { files, takenAt };
  rootFilesCache.set(config, roots);
  return roots;
}

/**
 * Root files per config, for the life of the process. A runtime asks for the
 * owner of many files under one solution, and each question would otherwise
 * spawn the compiler again for the same answer.
 */
const rootFilesCache = new Map<string, RootFiles>();

/**
 * Whether `file` was created or changed at or after `time`. The change time is
 * the one timestamp a program cannot set, so a file copied in with a preserved,
 * older modification time still counts.
 */
function createdSince(file: string, time: number): boolean {
  try {
    return fs.statSync(file).ctimeMs >= time;
  } catch {
    return false;
  }
}

function isDirectory(location: string): boolean {
  try {
    return fs.statSync(location).isDirectory();
  } catch {
    return false;
  }
}

function isFile(location: string): boolean {
  try {
    return fs.statSync(location).isFile();
  } catch {
    return false;
  }
}
