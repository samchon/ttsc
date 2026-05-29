import type { IPlaygroundDependencyInstallOptions } from "../structures/IPlaygroundDependencyInstallOptions";
import type { IPlaygroundDependencyInstallResult } from "../structures/IPlaygroundDependencyInstallResult";
import type { IPlaygroundDependencyProgressPhase } from "../structures/IPlaygroundDependencyProgressPhase";
import { BUILT_IN_PLAYGROUND_PACKAGES } from "./BUILT_IN_PLAYGROUND_PACKAGES";
import {
  DECLARATION_FILE_REGEXP,
  type IQueueItem,
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
  const queued = new Set<string>();
  const done = new Set<string>();
  const result: IPlaygroundDependencyInstallResult = {
    packages: [],
    compilerFiles: {},
    editorLibs: {},
    runtimeFiles: {},
  };

  const enqueue = (item: IQueueItem): void => {
    if (ignored.has(item.name) || installed.has(item.name)) return;
    if (queued.has(item.name) || done.has(item.name)) return;
    queued.add(item.name);
    queue.push(item);
    report("queued", item, `Queued ${item.name}`);
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
    enqueue({ name, range: "latest", optional: false });
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
      item.name,
      item.optional,
      options.signal,
    );
    throwIfAborted(options.signal);
    if (!metadata) {
      done.add(item.name);
      report("skip", item, `Skipped optional ${item.name}`);
      continue;
    }

    const version = selectVersion(metadata, item.range);
    const versionMetadata = metadata.versions[version];
    const tarball = versionMetadata?.dist?.tarball;
    if (!versionMetadata || !tarball) {
      if (item.optional) {
        done.add(item.name);
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

    done.add(item.name);
    installed.add(item.name);
    report("done", item, `Installed ${item.name}@${version}`, version);

    enqueuePackageDependencies(packageJson, enqueue);
    if (declarationCount === 0 && !item.name.startsWith("@types/")) {
      enqueue({
        name: toTypesPackageName(item.name),
        range: "latest",
        optional: true,
      });
    }
  }

  report("done", null, "Dependency install complete");
  return result;
}
