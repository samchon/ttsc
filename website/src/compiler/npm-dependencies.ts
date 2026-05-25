export type IPlaygroundDependencyProgressPhase =
  | "queued"
  | "resolve"
  | "download"
  | "extract"
  | "skip"
  | "error"
  | "done";

export interface IPlaygroundDependencyProgress {
  phase: IPlaygroundDependencyProgressPhase;
  packageName?: string;
  version?: string;
  completed: number;
  total: number;
  message: string;
}

export interface IPlaygroundDependencyPackage {
  name: string;
  version: string;
  tarball: string;
  fileCount: number;
  declarationCount: number;
}

export interface IPlaygroundDependencyInstallResult {
  packages: IPlaygroundDependencyPackage[];
  compilerFiles: Record<string, string>;
  editorLibs: Record<string, string>;
  runtimeFiles: Record<string, string>;
}

export interface IPlaygroundDependencyInstallOptions {
  fetch?: FetchLike;
  installedPackages?: Iterable<string>;
  ignoredPackages?: Iterable<string>;
  maxPackages?: number;
  signal?: AbortSignal;
  onProgress?: (event: IPlaygroundDependencyProgress) => void;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface IQueueItem {
  name: string;
  range: string;
  optional: boolean;
}

interface INpmMetadata {
  name: string;
  "dist-tags"?: Record<string, string>;
  versions: Record<string, INpmVersionMetadata | undefined>;
}

interface INpmVersionMetadata {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  dist?: {
    tarball?: string;
  };
}

interface IPackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  peerDependenciesMeta?: Record<string, { optional?: boolean }>;
}

interface IUnpackedPackage {
  files: Record<string, string>;
  packageJson: IPackageJson;
}

export const BUILT_IN_PLAYGROUND_PACKAGES = [
  "typia",
  "@typia/interface",
  "@typia/utils",
  "@standard-schema/spec",
] as const;

const DEFAULT_MAX_PACKAGES = 48;

const MODULE_SPECIFIER_REGEXP =
  /\b(?:import|export)\s+(?:type\s+)?(?:[^"'()]*?\s+from\s*)?["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|require\s*\(\s*["']([^"']+)["']\s*\)/g;

const BUILTIN_MODULES = new Set([
  "assert",
  "buffer",
  "child_process",
  "console",
  "constants",
  "crypto",
  "dns",
  "events",
  "fs",
  "http",
  "https",
  "module",
  "net",
  "os",
  "path",
  "perf_hooks",
  "process",
  "punycode",
  "querystring",
  "readline",
  "stream",
  "string_decoder",
  "timers",
  "tls",
  "tty",
  "url",
  "util",
  "vm",
  "worker_threads",
  "zlib",
]);

const TEXT_FILE_REGEXP =
  /(^package\.json$|\.([cm]?js|jsx|[cm]?ts|tsx|json)$|\.d\.[cm]?ts$)/i;
const DECLARATION_FILE_REGEXP = /\.d\.[cm]?ts$/i;
const RUNTIME_FILE_REGEXP = /(^package\.json$|\.([cm]?js|json)$)/i;

export function collectExternalPackageNames(
  source: string,
  ignoredPackages: Iterable<string> = BUILT_IN_PLAYGROUND_PACKAGES,
): string[] {
  const ignored = new Set(ignoredPackages);
  const found = new Set<string>();
  for (const specifier of collectModuleSpecifiers(source)) {
    const packageName = packageNameFromSpecifier(specifier);
    if (packageName && !ignored.has(packageName)) found.add(packageName);
  }
  return [...found].sort();
}

export function packageNameFromSpecifier(specifier: string): string | null {
  if (
    specifier.startsWith("#") ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    /^[a-z][a-z0-9+.-]*:/i.test(specifier)
  )
    return null;
  const bare = specifier.startsWith("node:") ? specifier.slice(5) : specifier;
  const first = bare.split("/")[0];
  if (first && BUILTIN_MODULES.has(first)) return null;
  if (bare.startsWith("@")) {
    const firstSlash = bare.indexOf("/");
    if (firstSlash < 0) return null;
    if (firstSlash === 1) return null;
    const secondSlash = bare.indexOf("/", firstSlash + 1);
    if (secondSlash === firstSlash + 1) return null;
    return secondSlash < 0 ? bare : bare.slice(0, secondSlash);
  }
  const slash = bare.indexOf("/");
  return slash < 0 ? bare : bare.slice(0, slash);
}

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

function collectModuleSpecifiers(source: string): string[] {
  const out: string[] = [];
  MODULE_SPECIFIER_REGEXP.lastIndex = 0;
  for (;;) {
    const match = MODULE_SPECIFIER_REGEXP.exec(source);
    if (!match) break;
    const specifier = match[1] ?? match[2] ?? match[3];
    if (specifier) out.push(specifier);
  }
  return out;
}

async function fetchNpmMetadata(
  fetchImpl: FetchLike,
  packageName: string,
  optional: boolean,
  signal: AbortSignal | undefined,
): Promise<INpmMetadata | null> {
  const response = await fetchImpl(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}`,
    {
      headers: {
        Accept: "application/vnd.npm.install-v1+json, application/json",
      },
      signal,
    },
  );
  if (response.status === 404 && optional) return null;
  if (!response.ok) {
    throw new Error(
      `npm registry returned ${response.status} while resolving ${packageName}.`,
    );
  }
  return (await response.json()) as INpmMetadata;
}

function selectVersion(metadata: INpmMetadata, range: string): string {
  const versions = metadata.versions;
  if (versions[range]) return range;
  const tag = metadata["dist-tags"]?.[range];
  if (tag && versions[tag]) return tag;
  const normalized = range.replace(/^[~^<>= ]+/, "").trim();
  if (normalized && versions[normalized]) return normalized;
  const latest = metadata["dist-tags"]?.latest;
  if (latest && versions[latest]) return latest;
  const all = Object.keys(versions).sort(compareVersionDesc);
  const fallback = all[0];
  if (!fallback) throw new Error(`No versions found for ${metadata.name}.`);
  return fallback;
}

async function downloadTarball(
  fetchImpl: FetchLike,
  tarball: string,
  signal: AbortSignal | undefined,
): Promise<ArrayBuffer> {
  const response = await fetchImpl(tarball, { signal });
  if (!response.ok) {
    throw new Error(`tarball download failed with HTTP ${response.status}.`);
  }
  return response.arrayBuffer();
}

async function unpackNpmTarball(
  tgz: ArrayBuffer,
  signal: AbortSignal | undefined,
): Promise<IUnpackedPackage> {
  throwIfAborted(signal);
  const tar = await gunzip(tgz);
  throwIfAborted(signal);
  const decoder = new TextDecoder();
  const files: Record<string, string> = {};
  let packageJson: IPackageJson = {};
  let offset = 0;
  let longPath: string | null = null;
  let paxPath: string | null = null;

  while (offset + 512 <= tar.length) {
    throwIfAborted(signal);
    const header = tar.subarray(offset, offset + 512);
    offset += 512;
    if (header.every((value) => value === 0)) break;

    const type = String.fromCharCode(header[156] ?? 0);
    const size = parseOctal(header.subarray(124, 136));
    const body = tar.subarray(offset, offset + size);
    offset += Math.ceil(size / 512) * 512;

    if (type === "L") {
      longPath = trimNull(decoder.decode(body));
      continue;
    }
    if (type === "x") {
      paxPath = parsePaxPath(decoder.decode(body));
      continue;
    }
    if (type !== "0" && type !== "\0") {
      longPath = null;
      paxPath = null;
      continue;
    }

    const rawPath =
      paxPath ?? longPath ?? readTarString(header.subarray(0, 100), decoder);
    longPath = null;
    paxPath = null;
    const rel = stripTarRoot(rawPath);
    if (!rel || !TEXT_FILE_REGEXP.test(rel)) continue;

    const text = decoder.decode(body);
    files[rel] = text;
    if (rel === "package.json") {
      try {
        packageJson = JSON.parse(text) as IPackageJson;
      } catch {
        packageJson = {};
      }
    }
  }

  return { files, packageJson };
}

function throwIfAborted(signal: AbortSignal | undefined): void {
  if (!signal?.aborted) return;
  if (signal.reason !== undefined) throw signal.reason;
  throw new DOMException("The operation was aborted.", "AbortError");
}

async function gunzip(input: ArrayBuffer): Promise<Uint8Array> {
  if (!("DecompressionStream" in globalThis)) {
    throw new Error(
      "This browser cannot unpack npm tgz files because DecompressionStream is unavailable.",
    );
  }
  const stream = new Blob([input])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function mountPackageFiles(
  packageName: string,
  files: Record<string, string>,
): IPlaygroundDependencyInstallResult {
  const compilerFiles: Record<string, string> = {};
  const editorLibs: Record<string, string> = {};
  const runtimeFiles: Record<string, string> = {};

  for (const [rel, text] of Object.entries(files)) {
    const packageRel = `${packageName}/${rel}`;
    compilerFiles[`node_modules/${packageRel}`] = text;
    if (rel === "package.json" || DECLARATION_FILE_REGEXP.test(rel)) {
      editorLibs[`file:///node_modules/${packageRel}`] = text;
    }
    if (RUNTIME_FILE_REGEXP.test(rel)) {
      runtimeFiles[packageRel] = text;
    }
  }

  return { packages: [], compilerFiles, editorLibs, runtimeFiles };
}

function enqueuePackageDependencies(
  packageJson: IPackageJson,
  enqueue: (item: IQueueItem) => void,
): void {
  for (const [name, range] of Object.entries(packageJson.dependencies ?? {})) {
    if (isRegistryRange(range)) enqueue({ name, range, optional: false });
  }
  for (const [name, range] of Object.entries(
    packageJson.peerDependencies ?? {},
  )) {
    const optional =
      packageJson.peerDependenciesMeta?.[name]?.optional === true;
    if (!optional && isRegistryRange(range))
      enqueue({ name, range, optional: true });
  }
}

function isRegistryRange(range: string): boolean {
  return !/^(file:|link:|workspace:|portal:|git\+|github:|https?:)/.test(range);
}

function toTypesPackageName(packageName: string): string {
  if (!packageName.startsWith("@")) return `@types/${packageName}`;
  const [scope, name] = packageName.slice(1).split("/");
  return scope && name ? `@types/${scope}__${name}` : `@types/${packageName}`;
}

function readTarString(bytes: Uint8Array, decoder: TextDecoder): string {
  return trimNull(decoder.decode(bytes));
}

function trimNull(text: string): string {
  const index = text.indexOf("\0");
  return (index < 0 ? text : text.slice(0, index)).trim();
}

function parseOctal(bytes: Uint8Array): number {
  const text = trimNull(new TextDecoder().decode(bytes)).trim();
  return text ? Number.parseInt(text, 8) : 0;
}

function parsePaxPath(text: string): string | null {
  let rest = text;
  while (rest.length > 0) {
    const space = rest.indexOf(" ");
    if (space < 0) return null;
    const length = Number(rest.slice(0, space));
    if (!Number.isFinite(length) || length <= space) return null;
    const record = rest.slice(space + 1, length - 1);
    const eq = record.indexOf("=");
    if (eq > 0 && record.slice(0, eq) === "path") return record.slice(eq + 1);
    rest = rest.slice(length);
  }
  return null;
}

function stripTarRoot(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return "";
  if (normalized.startsWith("package/"))
    return normalized.slice("package/".length);
  const slash = normalized.indexOf("/");
  return slash < 0 ? normalized : normalized.slice(slash + 1);
}

function compareVersionDesc(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  const pb = b.split(/[.-]/).map((part) => Number.parseInt(part, 10));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const av = Number.isFinite(pa[i]) ? pa[i]! : 0;
    const bv = Number.isFinite(pb[i]) ? pb[i]! : 0;
    if (av !== bv) return bv - av;
  }
  return b.localeCompare(a);
}
