import type { IPlaygroundDependencyInstallOptions } from "../structures/IPlaygroundDependencyInstallOptions";
import type { IPlaygroundDependencyInstallResult } from "../structures/IPlaygroundDependencyInstallResult";
import type { IPlaygroundDependencyProgressPhase } from "../structures/IPlaygroundDependencyProgressPhase";
import { BUILT_IN_PLAYGROUND_PACKAGES } from "./BUILT_IN_PLAYGROUND_PACKAGES";
import {
  DECLARATION_FILE_REGEXP,
  type IQueueItem,
  type IVersionRequest,
  downloadTarball,
  enqueuePackageDependencies,
  fetchNpmMetadata,
  mountPackageFiles,
  selectVersion,
  throwIfAborted,
  toTypesPackageName,
  unpackNpmTarball,
} from "./internal/npmRegistry";

const DEFAULT_MAX_PACKAGES = 48;

/**
 * Resolve, download, and unpack a set of npm packages directly inside the
 * browser, returning their files keyed for the wasm-side MemFS, Monaco's
 * extra-libs registry, and the in-page execute sandbox `require`.
 *
 * Transitive dependencies are followed via the resolved `package.json`'s
 * `dependencies` and (non-optional) `peerDependencies` fields. The walk is
 * bounded by `maxPackages` to keep a single keystroke from exhausting the tab's
 * network/memory budget.
 */
export async function installPlaygroundDependencies(
  packageNames: Iterable<string>,
  options: IPlaygroundDependencyInstallOptions = {},
): Promise<IPlaygroundDependencyInstallResult> {
  const fetchImpl = options.fetch ?? globalThis.fetch?.bind(globalThis);
  if (!fetchImpl) {
    throw new Error("installPlaygroundDependencies requires fetch.");
  }
  throwIfAborted(options.signal);

  const ignored = new Set(
    options.ignoredPackages ?? BUILT_IN_PLAYGROUND_PACKAGES,
  );
  const installed = new Set(options.installedPackages ?? []);
  const maxPackages = options.maxPackages ?? DEFAULT_MAX_PACKAGES;
  const queue: IQueueItem[] = [];
  const queued = new Map<string, IQueueItem>();
  const done = new Map<string, string>();
  const metadataByName = new Map<string, Parameters<typeof selectVersion>[0]>();
  const result: IPlaygroundDependencyInstallResult = {
    packages: [],
    compilerFiles: {},
    editorLibs: {},
    runtimeFiles: {},
  };

  const enqueue = (item: IQueueItem): void => {
    const normalized = normalizeRegistryRequest(item);
    if (ignored.has(normalized.name)) return;
    const known = queued.get(normalized.name);
    if (known) {
      if (known.registryName !== normalized.registryName) {
        throw new Error(
          `Conflicting npm aliases for ${normalized.name}: ${known.registryName} and ${normalized.registryName}.`,
        );
      }
      known.requests ??= [toVersionRequest(known)];
      known.requests.push(toVersionRequest(normalized));
      known.optional &&= normalized.optional;
      const completed = done.get(normalized.name);
      const metadata = metadataByName.get(normalized.name);
      if (completed !== undefined && metadata) {
        // A dependency can discover an additional range after this package has
        // already been installed. Pin the installed version into the combined
        // solve so a compatible late constraint is accepted, but a range that
        // rejects the mounted version fails instead of being silently lost.
        selectQueuedVersion(metadata, known, [completed]);
      } else if (completed !== undefined && !known.optional) {
        // An optional 404 may later be reached through a required edge. Retry
        // that edge so the required dependency cannot remain silently absent.
        done.delete(normalized.name);
        queue.push(known);
      }
      return;
    }
    if (installed.has(normalized.name)) return;
    normalized.requests = [toVersionRequest(normalized)];
    queued.set(normalized.name, normalized);
    queue.push(normalized);
    report("queued", normalized, `Queued ${normalized.name}`);
  };

  const report = (
    phase: IPlaygroundDependencyProgressPhase,
    item: IQueueItem | null,
    message: string,
    version?: string,
  ): void => {
    options.onProgress?.({
      phase,
      packageName: item?.name,
      version,
      completed: done.size,
      total: Math.max(queue.length, done.size + (item ? 1 : 0)),
      message,
    });
  };

  for (const name of packageNames) {
    enqueue({ name, range: "*", optional: false, requester: "source" });
  }

  for (let index = 0; index < queue.length; index++) {
    if (done.size >= maxPackages) {
      throw new Error(
        `Dependency install stopped after ${maxPackages} packages. Narrow the imports or raise maxPackages.`,
      );
    }

    const item = queue[index]!;
    if (installed.has(item.name) || done.has(item.name)) continue;
    throwIfAborted(options.signal);

    report("resolve", item, `Resolving ${item.name}`);
    const metadata = await fetchNpmMetadata(
      fetchImpl,
      item.registryName ?? item.name,
      item.optional,
      options.signal,
    );
    throwIfAborted(options.signal);
    if (!metadata) {
      done.set(item.name, "");
      report("skip", item, `Skipped optional ${item.name}`);
      continue;
    }

    metadataByName.set(item.name, metadata);
    const version = selectQueuedVersion(metadata, item);
    const versionMetadata = metadata.versions[version];
    const tarball = versionMetadata?.dist?.tarball;
    if (!versionMetadata || !tarball) {
      if (item.optional) {
        done.set(item.name, version);
        report("skip", item, `Skipped optional ${item.name}`);
        continue;
      }
      throw new Error(`No tarball found for ${item.name}@${version}.`);
    }

    report("download", item, `Downloading ${item.name}@${version}`, version);
    const tgz = await downloadTarball(fetchImpl, tarball, options.signal);
    throwIfAborted(options.signal);
    report("extract", item, `Extracting ${item.name}@${version}`, version);
    const unpacked = await unpackNpmTarball(tgz, options.signal);
    throwIfAborted(options.signal);
    const packageJson = {
      ...versionMetadata,
      ...unpacked.packageJson,
    };
    const mounted = mountPackageFiles(item.name, unpacked.files);

    Object.assign(result.compilerFiles, mounted.compilerFiles);
    Object.assign(result.editorLibs, mounted.editorLibs);
    Object.assign(result.runtimeFiles, mounted.runtimeFiles);

    const declarationCount = Object.keys(mounted.editorLibs).filter((key) =>
      DECLARATION_FILE_REGEXP.test(key),
    ).length;
    result.packages.push({
      name: item.name,
      version,
      tarball,
      fileCount: Object.keys(mounted.compilerFiles).length,
      declarationCount,
    });

    done.set(item.name, version);
    installed.add(item.name);
    report("done", item, `Installed ${item.name}@${version}`, version);

    enqueuePackageDependencies(packageJson, enqueue, item.name);
    if (declarationCount === 0 && !item.name.startsWith("@types/")) {
      enqueue({
        name: toTypesPackageName(item.name),
        range: "*",
        optional: true,
        requester: item.name,
      });
    }
  }

  report("done", null, "Dependency install complete");
  return result;
}

function normalizeRegistryRequest(item: IQueueItem): IQueueItem {
  if (!item.range.startsWith("npm:"))
    return { ...item, registryName: item.name };
  const match = /^npm:((?:@[^/]+\/)?[^@/]+)(?:@(.+))?$/.exec(item.range);
  if (!match) {
    throw new Error(
      `Unsupported npm alias ${JSON.stringify(item.range)} for ${item.name}.`,
    );
  }
  return {
    ...item,
    registryName: match[1]!,
    range: match[2] || "*",
  };
}

function toVersionRequest(item: IQueueItem): IVersionRequest {
  return { range: item.range, requester: item.requester };
}

function selectQueuedVersion(
  metadata: Parameters<typeof selectVersion>[0],
  item: IQueueItem,
  extraRanges: readonly string[] = [],
): string {
  const requests = item.requests ?? [toVersionRequest(item)];
  const ranges = [...requests.map((request) => request.range), ...extraRanges];
  try {
    return selectVersion(metadata, ranges);
  } catch (error) {
    if (requests.length < 2) throw error;
    const message = error instanceof Error ? error.message : String(error);
    const requestedBy = requests
      .map(
        ({ requester, range }) =>
          `${requester} requests ${JSON.stringify(range)}`,
      )
      .join("; ");
    throw new Error(`${message} Requested by ${requestedBy}.`);
  }
}
