import type { IPlaygroundDependencyInstallOptions } from "../structures/IPlaygroundDependencyInstallOptions";
import type { IPlaygroundDependencyInstallResult } from "../structures/IPlaygroundDependencyInstallResult";
import type { IPlaygroundDependencyProgressPhase } from "../structures/IPlaygroundDependencyProgressPhase";
import type { IPlaygroundInstalledDependency } from "../structures/IPlaygroundInstalledDependency";
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
  validateNpmByteLimit,
  verifyTarball,
} from "./internal/npmRegistry";

const DEFAULT_MAX_PACKAGES = 48;
const DEFAULT_MAX_TARBALL_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_UNPACKED_BYTES = 64 * 1024 * 1024;

/**
 * Resolve, download, and unpack a set of npm packages directly inside the
 * browser, returning their files keyed for the wasm-side MemFS, Monaco's
 * extra-libs registry, and the in-page execute sandbox `require`.
 *
 * Transitive dependencies are followed via the resolved `package.json`'s
 * required, optional, and peer dependency fields. Passing a prior call's
 * `resolvedDependencies` validates new edges against the exact mounted graph
 * and reuses compatible packages without downloading their tarballs again. The
 * walk is bounded by `maxPackages` to keep a single keystroke from exhausting
 * the tab's network/memory budget.
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
  const installedNames = new Set(options.installedPackages ?? []);
  const installedDependencies = new Map<
    string,
    IPlaygroundInstalledDependency
  >();
  for (const dependency of options.installedDependencies ?? []) {
    const previous = installedDependencies.get(dependency.name);
    if (
      previous !== undefined &&
      (previous.registryName !== dependency.registryName ||
        previous.version !== dependency.version)
    ) {
      throw new Error(
        `Conflicting mounted identities for ${dependency.name}: ${previous.registryName}@${previous.version} and ${dependency.registryName}@${dependency.version}.`,
      );
    }
    if (previous !== undefined) {
      previous.requests.push(
        ...dependency.requests.map((request) => ({ ...request })),
      );
      continue;
    }
    installedDependencies.set(dependency.name, {
      ...dependency,
      requests: dependency.requests.map((request) => ({ ...request })),
    });
  }
  const maxPackages = options.maxPackages ?? DEFAULT_MAX_PACKAGES;
  const maxTarballBytes = options.maxTarballBytes ?? DEFAULT_MAX_TARBALL_BYTES;
  const maxUnpackedBytes =
    options.maxUnpackedBytes ?? DEFAULT_MAX_UNPACKED_BYTES;
  validateNpmByteLimit(maxTarballBytes, "compressed");
  validateNpmByteLimit(maxUnpackedBytes, "expanded");
  const queue: IQueueItem[] = [];
  const queued = new Map<string, IQueueItem>();
  const done = new Map<string, string>();
  const metadataByName = new Map<string, Parameters<typeof selectVersion>[0]>();
  const result: IPlaygroundDependencyInstallResult = {
    resolvedDependencies: [],
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
        if (normalized.optional) return;
        const completed = done.get(normalized.name);
        if (known.optional && (completed === undefined || completed === "")) {
          known.registryName = normalized.registryName;
          known.range = normalized.range;
          known.requester = normalized.requester;
          known.requests = [toVersionRequest(normalized)];
          known.optional = false;
          metadataByName.delete(normalized.name);
          if (completed === "") {
            done.delete(normalized.name);
            queue.push(known);
          }
          return;
        }
        throw registryIdentityConflict(
          normalized.name,
          known.registryName!,
          normalized,
        );
      }
      known.requests ??= [toVersionRequest(known)];
      known.requests.push(toVersionRequest(normalized));
      known.optional = known.requests.every((request) => request.optional);
      const completed = done.get(normalized.name);
      const metadata = metadataByName.get(normalized.name);
      if (completed !== undefined && completed.length !== 0 && metadata) {
        // A dependency can discover an additional range after this package has
        // already been installed. Pin the installed version into the combined
        // solve so a compatible late constraint is accepted, but a range that
        // rejects the mounted version fails instead of being silently lost.
        try {
          selectQueuedVersion(metadata, known, [completed]);
        } catch (error) {
          const mounted = installedDependencies.get(normalized.name);
          if (mounted) throw mountedVersionConflict(mounted, error);
          throw error;
        }
      } else if (completed !== undefined && !known.optional) {
        // An optional 404 may later be reached through a required edge. Retry
        // that edge so the required dependency cannot remain silently absent.
        done.delete(normalized.name);
        queue.push(known);
      }
      return;
    }
    const mounted = installedDependencies.get(normalized.name);
    if (mounted && mounted.registryName !== normalized.registryName) {
      if (normalized.optional) return;
      throw registryIdentityConflict(
        normalized.name,
        mounted.registryName,
        normalized,
      );
    }
    if (installedNames.has(normalized.name) && mounted === undefined) return;
    normalized.requests = [
      ...(mounted?.requests.map((request) => ({ ...request })) ?? []),
      toVersionRequest(normalized),
    ];
    normalized.optional = normalized.requests.every(
      (request) => request.optional,
    );
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
    if (done.has(item.name)) continue;
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
      const mounted = installedDependencies.get(item.name);
      if (mounted) {
        // A missing registry entry gives us no way to validate a new optional
        // range or tag. Preserve the already-published optional requests and
        // omit the new edge instead of claiming the mounted version satisfies
        // a constraint we never checked.
        item.requests = mounted.requests.map((request) => ({ ...request }));
        item.optional = item.requests.every((request) => request.optional);
      }
      done.set(item.name, mounted?.version ?? "");
      report(
        mounted ? "done" : "skip",
        item,
        mounted
          ? `Reused mounted ${item.name}@${mounted.version}`
          : `Skipped optional ${item.name}`,
        mounted?.version,
      );
      continue;
    }

    metadataByName.set(item.name, metadata);
    const mounted = installedDependencies.get(item.name);
    let version: string | null;
    try {
      version = selectQueuedVersion(
        metadata,
        item,
        mounted ? [mounted.version] : [],
      );
    } catch (error) {
      if (mounted) throw mountedVersionConflict(mounted, error);
      throw error;
    }
    if (version === null) {
      done.set(item.name, mounted?.version ?? "");
      report("skip", item, `Skipped optional ${item.name}`);
      continue;
    }
    if (mounted) {
      done.set(item.name, mounted.version);
      report(
        "done",
        item,
        `Reused mounted ${item.name}@${mounted.version}`,
        mounted.version,
      );
      continue;
    }
    const versionMetadata = metadata.versions[version];
    const tarball = versionMetadata?.dist?.tarball;
    if (!versionMetadata || !tarball) {
      throw new Error(`No tarball found for ${item.name}@${version}.`);
    }

    let unpacked: Awaited<ReturnType<typeof unpackNpmTarball>>;
    try {
      report("download", item, `Downloading ${item.name}@${version}`, version);
      const tgz = await downloadTarball(
        fetchImpl,
        tarball,
        options.signal,
        maxTarballBytes,
      );
      throwIfAborted(options.signal);
      await verifyTarball(tgz, versionMetadata.dist ?? {}, options.signal);
      throwIfAborted(options.signal);
      report("extract", item, `Extracting ${item.name}@${version}`, version);
      unpacked = await unpackNpmTarball(tgz, options.signal, maxUnpackedBytes);
    } catch (error) {
      if (options.signal?.aborted) throw error;
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to install ${item.name}@${version}: ${message}`, {
        cause: error,
      });
    }
    throwIfAborted(options.signal);
    const packageJson = {
      ...versionMetadata,
      ...unpacked.packageJson,
    };
    const mountedFiles = mountPackageFiles(item.name, unpacked.files);

    Object.assign(result.compilerFiles, mountedFiles.compilerFiles);
    Object.assign(result.editorLibs, mountedFiles.editorLibs);
    Object.assign(result.runtimeFiles, mountedFiles.runtimeFiles);

    const declarationCount = Object.keys(mountedFiles.editorLibs).filter(
      (key) => DECLARATION_FILE_REGEXP.test(key),
    ).length;
    result.packages.push({
      name: item.name,
      registryName: item.registryName ?? item.name,
      version,
      tarball,
      fileCount: Object.keys(mountedFiles.compilerFiles).length,
      declarationCount,
    });

    done.set(item.name, version);
    installedNames.add(item.name);
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

  const resolved = new Map(installedDependencies);
  for (const [name, version] of done) {
    if (version.length === 0) continue;
    const item = queued.get(name)!;
    resolved.set(name, {
      name,
      registryName: item.registryName ?? name,
      version,
      requests: (item.requests ?? [toVersionRequest(item)]).map((request) => ({
        ...request,
      })),
    });
  }
  result.resolvedDependencies = [...resolved.values()].map((dependency) => ({
    ...dependency,
    requests: dependency.requests.map((request) => ({ ...request })),
  }));
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
  return {
    optional: item.optional,
    range: item.range,
    requester: item.requester,
  };
}

function selectQueuedVersion(
  metadata: Parameters<typeof selectVersion>[0],
  item: IQueueItem,
  extraRanges: readonly string[] = [],
): string | null {
  const requests = item.requests ?? [toVersionRequest(item)];
  const required = requests.filter((request) => !request.optional);
  const optional = requests.filter((request) => request.optional);
  const accepted = [...required];
  let selected: string | null = null;

  if (required.length !== 0) {
    try {
      selected = selectVersion(metadata, [
        ...required.map((request) => request.range),
        ...extraRanges,
      ]);
    } catch (error) {
      throw requestedVersionError(error, required);
    }
  }

  for (const request of optional) {
    try {
      const candidate = selectVersion(metadata, [
        ...accepted.map((acceptedRequest) => acceptedRequest.range),
        request.range,
        ...extraRanges,
      ]);
      accepted.push(request);
      selected = candidate;
    } catch {
      // Optional ranges refine the selected version only when they are
      // compatible with every required edge and the mounted-version pin.
    }
  }
  item.requests = accepted;
  item.optional = accepted.every((request) => request.optional);
  return selected;
}

function requestedVersionError(
  error: unknown,
  requests: readonly IVersionRequest[],
): Error {
  const message = error instanceof Error ? error.message : String(error);
  const requestedBy = requests
    .map(
      ({ requester, range }) =>
        `${requester} requests ${JSON.stringify(range)}`,
    )
    .join("; ");
  return new Error(`${message} Requested by ${requestedBy}.`);
}

function mountedVersionConflict(
  mounted: IPlaygroundInstalledDependency,
  error: unknown,
): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(
    `Mounted ${mounted.name}@${mounted.version} from ${mounted.registryName} is incompatible with the active dependency graph. ${message}`,
  );
}

function registryIdentityConflict(
  name: string,
  registryName: string,
  incoming: IQueueItem,
): Error {
  return new Error(
    `Conflicting registry identities for ${name}: mounted or queued from ${registryName}, but ${incoming.requester} requests ${JSON.stringify(incoming.range)} from ${incoming.registryName}.`,
  );
}
