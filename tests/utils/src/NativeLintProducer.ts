import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { E2eProcessTrace } from "./E2eProcessTrace";
import { TestProject } from "./TestProject";

/**
 * An immutable package snapshot and the manifest proving its captured bytes.
 *
 * The native compiler consumes packageRoot. The sibling manifest records the
 * selected files and installation target; its digest protects that record,
 * without certifying a loaded binary or the external dependency tree.
 *
 * @evidence contracts/common.md#principled-implementation Four readonly fields identify the captured package, original source and independently stored manifest digest.
 * @evidence contracts/common.md#clear-and-simple-design The package and source locations are distinct from the proof file and its SHA-256, keeping execution input separate from its observation.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The handle names a real source snapshot and proof; it does not claim loaded-binary identity or successful execution.
 * @evidence contracts/common.md#meaningful-documentation Field comments distinguish compiled package input, original authored location and manifest integrity.
 * @evidence contracts/portability.md#os-neutral-implementation Native absolute roots locate files; the digest is a content identity rather than a path-case or process-liveness claim.
 * @evidenceExclude contracts/performance.md#efficient-algorithms INativeLintProducer defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work INativeLintProducer defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources INativeLintProducer carries data or signatures; acquisition and release remain with the implementing operation.
 */
export interface INativeLintProducer {
  /** Absolute copied package root resolved by snapshot consumers. */
  readonly packageRoot: string;

  /** Physical authored package root from which the snapshot was captured. */
  readonly sourceRoot: string;

  /** Absolute sibling manifest location outside the compiled package tree. */
  readonly manifestPath: string;

  /** SHA-256 of the original manifest bytes, checked on every shared reuse. */
  readonly manifestSha256: string;
}

interface IFileReading {
  name: string;
  bytes: number;
  mode: number;
  sha256: string;
}

/**
 * Compiler-selected test declarations omitted from an authored package copy.
 *
 * Metadata retains the Go selection that justifies each omission. An optional
 * environment snapshot allows the shared owner to refuse reuse after source
 * selection inputs change; it is not a native artifact cache key.
 *
 * @evidence contracts/common.md#principled-implementation Exact omitted file names and original Go metadata preserve the source-selection proof, with optional environment observations for later admission.
 * @evidence contracts/common.md#clear-and-simple-design One readonly selection separates compiler-reported exclusions, their metadata basis and environment validity inputs.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Selection carries original observations rather than inferring tests by suffix or declaring native build success.
 * @evidence contracts/common.md#meaningful-documentation The native comment and fields identify compiler-selected omissions and the optional environment snapshot.
 * @evidence contracts/portability.md#os-neutral-implementation Excluded names use slash-relative package spelling; metadata carries Go-reported native directories and environment values without OS-name case inference.
 * @evidenceExclude contracts/performance.md#efficient-algorithms INativeLintSourceSelection defines a representation; it chooses no processing algorithm.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work INativeLintSourceSelection defines no computation-sharing or invalidation policy.
 * @evidenceExclude contracts/performance.md#bound-retention-and-release-resources INativeLintSourceSelection carries data or signatures; acquisition and release remain with the implementing operation.
 */
export interface INativeLintSourceSelection {
  /** Sorted slash-relative declarations not selected as compiled or embedded input. */
  readonly excludedGoTestFiles: readonly string[];

  /** Original Go package records that justify the excluded population. */
  readonly metadata: readonly unknown[];

  /** Observed selection environment; absent when no environment proof was supplied. */
  readonly environment?: Readonly<Record<string, string | null>>;
}

let sharedProducer: INativeLintProducer | undefined;
let sharedProducerRoot: string | undefined;
let sharedProducerRetentionReason: string | undefined;

/**
 * Preserve existing shared inputs when descendant completion is unknown.
 *
 * No snapshot or cache is created here. The exact allocation owner validates
 * retention and subsequent consumers cannot reuse this unresolved producer. The
 * caller must establish descendant closure before reclaiming these roots.
 *
 * @evidence contracts/common.md#principled-implementation Retains only the recorded snapshot allocation and already owned cache; sticky refusal prevents another consumer from using inputs with unresolved process ownership.
 * @evidence contracts/common.md#clear-and-simple-design One lifecycle operation delegates filesystem identity checks to TestProject and leaves capture and content validation unchanged.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not allocate a substitute producer, claim descendant closure or mutate an external cache selected through the environment.
 * @evidence contracts/common.md#meaningful-documentation Explains the existing-input scope, continued reuse refusal and unresolved reclamation responsibility.
 * @evidence contracts/performance.md#bound-retention-and-release-resources At most the existing snapshot and internally allocated cache transfer out of exit cleanup; unresolved readers forbid further capture/reuse in this process. Later reclamation remains blocked until its caller establishes closure.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Delegated allocation owners validate native root and ancestor identity; this operation never acquires deletion authority over an external cache.
 * @evidence contracts/performance.md#efficient-algorithms A fixed number of existing owners are notified; each owner's ancestor/allocation checks determine the delegated cost.
 * @evidence contracts/performance.md#reuse-equivalent-work The first reason is kept and subsequent consumers refuse the shared producer. Repeated retention cannot establish closure or create a new compatible snapshot.
 */
export function retainNativeLintProducer(reason: string): void {
  if (!reason.trim())
    throw new Error("Native input retention requires a reason");
  sharedProducerRetentionReason ??= reason;
  const failures: unknown[] = [];
  if (sharedProducerRoot !== undefined) {
    try {
      TestProject.retainTemporaryDirectory(sharedProducerRoot, reason);
    } catch (error) {
      failures.push(error);
    }
  }
  try {
    TestProject.retainSharedPluginCache(reason);
  } catch (error) {
    failures.push(error);
  }
  if (failures.length === 1) throw failures[0];
  if (failures.length > 1)
    throw new AggregateError(
      failures,
      "Shared native inputs could not all be retained",
    );
}

/**
 * Capture one authored lint package for consumers that never mutate its source.
 *
 * The copied package is the real package resolved by the consumer, including
 * its exports, descriptor, Go source and embedded assets. Its installation is
 * linked rather than copied: production build witnesses still own dependency,
 * SDK, toolchain and flag validity. This captures package bytes, not a binary
 * or an assertion that another source identity can reuse one. Go's `list -find`
 * selects exact non-embedded test declarations without resolving dependencies;
 * inherited and workspace/proxy-isolated source selections must agree. All
 * other files, including ignored OS alternatives, remain copied. Reuse refuses
 * changed selection environment, bytes, manifest or installation link. A
 * retained producer with unknown readers also refuses subsequent consumers.
 *
 * @evidence contracts/common.md#principled-implementation The shared producer is published only after independent before/copy/after content readings agree; changing authored input is refused rather than accepted under an earlier identity.
 * @evidence contracts/common.md#clear-and-simple-design One process-owned package snapshot and manifest serve explicitly opted-in consumers; cold and source-mutating callers keep the workspace package.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Consumers resolve a real copied package and installation link; no loader, capability, compiler, source digest or cache proof is replaced.
 * @evidence contracts/common.md#meaningful-documentation Documents the package-byte capture scope and leaves external installation, SDK and toolchain proof with the actual production build.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath, lstat and platform directory-link creation preserve actual installation identity; Go selects source according to the actual toolchain environment.
 * @evidence contracts/performance.md#efficient-algorithms First capture reads selected package bytes before/copy/after; every reuse hashes manifest and snapshot bytes again. Go selection runs twice at initial capture under inherited and isolated environments.
 * @evidence contracts/performance.md#reuse-equivalent-work One process snapshot is shared only while manifest digest, copied bytes, installation target and selection environment remain unchanged. Authored source is expected frozen for this process; native dependency/toolchain admission remains with the builder.
 * @evidence contracts/performance.md#bound-retention-and-release-resources One snapshot allocation and handle are retained per process. TestProject owns exit removal unless unknown readers retain it; failed initial capture can leave its tracked partial root until exit.
 */
export function getNativeLintProducer(): INativeLintProducer {
  if (sharedProducerRetentionReason !== undefined)
    throw new Error(
      "Shared native lint producer has unresolved process ownership: " +
        sharedProducerRetentionReason,
    );
  if (!sharedProducer) {
    const sourceRoot = path.join(
      TestProject.WORKSPACE_ROOT,
      "packages",
      "lint",
    );
    const destinationRoot = TestProject.tmpdir("ttsc-native-lint-producer-");
    sharedProducerRoot = destinationRoot;
    const selection = readGoSelection(sourceRoot);
    sharedProducer = captureNativeLintProducer({
      sourceRoot,
      destinationRoot,
      selection,
    });
  }
  const manifest = fs.readFileSync(sharedProducer.manifestPath);
  const saved = JSON.parse(manifest.toString());
  if (
    saved.selection?.environment &&
    JSON.stringify(saved.selection.environment) !==
      JSON.stringify(readSelectionEnvironment())
  )
    throw new Error(
      "Shared native lint producer selection environment was modified",
    );
  const installed = path.join(sharedProducer.packageRoot, "node_modules");
  if (
    saved.installation === null &&
    fs.lstatSync(installed, { throwIfNoEntry: false })
  )
    throw new Error(
      "Shared native lint producer installation link was modified",
    );
  if (
    saved.installation !== null &&
    (!fs.lstatSync(installed).isSymbolicLink() ||
      fs.realpathSync.native(installed) !== saved.installation)
  )
    throw new Error(
      "Shared native lint producer installation link was modified",
    );
  if (
    crypto.createHash("sha256").update(manifest).digest("hex") !==
      sharedProducer.manifestSha256 ||
    JSON.stringify(readPackage(sharedProducer.packageRoot)) !==
      JSON.stringify(JSON.parse(manifest.toString()).files)
  )
    throw new Error("Shared native lint producer snapshot was modified");
  return sharedProducer;
}

/**
 * Materialize a lint package snapshot and its independently checked manifest.
 *
 * `destinationRoot` must be an existing empty directory owned by the caller.
 * Every package file is copied except installation/cache/repository boundaries
 * and compiler-proven Go test declarations that are not embedded assets.
 * Unexpected source symlinks are refused; `node_modules` alone is a linked
 * installation whose validity remains the native build's responsibility. The
 * optional file copier is the explicit byte-copy boundary, allowing its caller
 * to verify corruption and concurrent-edit refusals without replacing
 * filesystem globals. Private enumeration and hashing implement this
 * operation.
 *
 * @evidence contracts/common.md#principled-implementation A sorted path/length/mode/SHA population must agree before capture, in the actual copy and after capture; package metadata must name the real lint package and a failed capture returns no producer.
 * @evidence contracts/common.md#clear-and-simple-design Enumeration, copying and proof comparison are sequential and call-local, with a sibling manifest outside the compiled package input tree.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reads every selected byte instead of trusting mtimes, forbids unexplained source links and retains production dependency/toolchain/cache guards; the copier cannot bypass the proof comparisons.
 * @evidence contracts/common.md#meaningful-documentation Documents the empty destination precondition, explicit copy boundary, manifest scope, installation link and refusal behavior.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath and lstat distinguish actual roots and forbid unexplained source links; installation is linked with junction on Windows and directory symlink elsewhere.
 * @evidence contracts/performance.md#efficient-algorithms Sorted enumeration and SHA-256 cover every selected byte in three readings. Copying is linear in total bytes and sorting scales with per-directory entry counts; no installed dependency tree is copied.
 * @evidence contracts/performance.md#reuse-equivalent-work The captured immutable bytes and manifest may serve compatible consumers; this function does not cache invocations or authorize reuse of external installation or native artifacts.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the empty destination and partial capture on failure. Synchronous IO closes before return, and the returned manifest/package paths transfer ownership without acquiring a child process.
 */
export function captureNativeLintProducer(props: {
  sourceRoot: string;
  destinationRoot: string;
  copyFile?: typeof fs.copyFileSync;
  selection?: INativeLintSourceSelection;
}): INativeLintProducer {
  const sourceRoot = fs.realpathSync.native(props.sourceRoot);
  const destinationRoot = fs.realpathSync.native(props.destinationRoot);
  if (fs.readdirSync(destinationRoot).length !== 0)
    throw new Error(
      "Native lint producer capture requires an empty destination",
    );
  const selection = props.selection
    ? selectNativeLintSourceFiles(
        sourceRoot,
        props.selection.metadata as IGoPackageSelection[],
      )
    : undefined;
  if (
    selection &&
    JSON.stringify(selection.excludedGoTestFiles) !==
      JSON.stringify(props.selection!.excludedGoTestFiles)
  )
    throw new Error(
      "Native lint producer selection proof does not match its excluded files",
    );
  const omitted = new Set(selection?.excludedGoTestFiles ?? []);
  const before = readPackage(sourceRoot, omitted);
  const packageRoot = path.join(destinationRoot, "lint");
  fs.mkdirSync(packageRoot);
  for (const file of before) {
    const target = path.join(packageRoot, ...file.name.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    (props.copyFile ?? fs.copyFileSync)(
      path.join(sourceRoot, ...file.name.split("/")),
      target,
    );
    fs.chmodSync(target, file.mode);
  }
  const copied = readPackage(packageRoot);
  const after = readPackage(sourceRoot, omitted);
  const expected = JSON.stringify(before);
  if (JSON.stringify(after) !== expected || JSON.stringify(copied) !== expected)
    throw new Error(
      "Native lint producer changed during capture or its copied bytes differ",
    );
  const metadata = JSON.parse(
    fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"),
  );
  if (metadata.name !== "@ttsc/lint")
    throw new Error(
      "Native lint producer capture requires the authored @ttsc/lint package",
    );
  const installation = path.join(sourceRoot, "node_modules");
  if (fs.existsSync(installation))
    fs.symlinkSync(
      fs.realpathSync.native(installation),
      path.join(packageRoot, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
  const manifest =
    JSON.stringify(
      {
        sourceRoot,
        installation: fs.existsSync(installation)
          ? fs.realpathSync.native(installation)
          : null,
        files: before,
        selection: selection
          ? { ...selection, environment: props.selection?.environment }
          : null,
      },
      null,
      2,
    ) + "\n";
  const manifestPath = path.join(destinationRoot, "manifest.json");
  fs.writeFileSync(manifestPath, manifest);
  return Object.freeze({
    packageRoot,
    sourceRoot,
    manifestPath,
    manifestSha256: crypto.createHash("sha256").update(manifest).digest("hex"),
  });
}

function readPackage(
  root: string,
  omitted: ReadonlySet<string> = new Set(),
): IFileReading[] {
  const files: IFileReading[] = [];
  const visit = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      // Installation, repository and cache boundaries are not package source. A
      // nested workspace member (the lint contributor demo) carries its own
      // node_modules link, which is installation too, so it is skipped at any depth.
      if (
        name === "node_modules" ||
        (directory === root && [".git", ".cache", ".ttsc"].includes(name))
      )
        continue;
      const file = path.join(directory, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink())
        throw new Error(
          `Native lint producer has an unaccounted source link: ${file}`,
        );
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile()) {
        const relative = path.relative(root, file).split(path.sep).join("/");
        if (omitted.has(relative)) continue;
        const content = fs.readFileSync(file);
        files.push({
          name: path.relative(root, file).split(path.sep).join("/"),
          bytes: content.length,
          mode: stat.mode & 0o777,
          sha256: crypto.createHash("sha256").update(content).digest("hex"),
        });
      } else
        throw new Error(
          `Native lint producer has an unsupported source entry: ${file}`,
        );
    }
  };
  visit(root);
  return files.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

interface IGoPackageSelection {
  Dir: string;
  GoFiles?: string[];
  CgoFiles?: string[];
  TestGoFiles?: string[];
  XTestGoFiles?: string[];
  EmbedFiles?: string[];
  Error?: unknown;
  DepsErrors?: unknown[];
  Incomplete?: boolean;
  InvalidGoFiles?: string[];
}

/**
 * Select only compiler-reported test declarations that are not embedded input.
 *
 * @evidence contracts/common.md#principled-implementation Rejects incomplete package metadata and escaped source names; only exact Go TestGoFiles/XTestGoFiles that do not occur in EmbedFiles are omitted.
 * @evidence contracts/common.md#clear-and-simple-design One deterministic metadata projection supplies both capture population and its stored selection proof.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Does not classify names by suffix or erase Go, Cgo or embedded inputs; package discovery failures cannot authorize a smaller source tree.
 * @evidence contracts/common.md#meaningful-documentation Describes the compile-input projection and leaves dependency/build validation with the real native builder.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native realpath and relative compare actual package directories; selected names are validated against both separators and serialized as slash-relative paths.
 * @evidence contracts/performance.md#efficient-algorithms Metadata traversal visits each reported package and file name; sets handle protected and excluded membership and one final sort orders excluded names. Realpath currently reobserves the source root per record.
 * @evidence contracts/performance.md#reuse-equivalent-work The returned proof can be shared with capture only when its excluded population agrees with the same compiler metadata; the function caches no filesystem or Go selection.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Call-local sets and the deep-copied metadata grow with reported input size and transfer to the caller; no Go process or open handle is owned here.
 */
export function selectNativeLintSourceFiles(
  sourceRoot: string,
  records: readonly IGoPackageSelection[],
): INativeLintSourceSelection {
  if (records.length === 0)
    throw new Error("Native lint producer selection has no packages");
  const excluded = new Set<string>();
  for (const record of records) {
    if (
      !record ||
      typeof record.Dir !== "string" ||
      record.Error ||
      record.Incomplete ||
      (record.DepsErrors?.length ?? 0) ||
      (record.InvalidGoFiles?.length ?? 0)
    )
      throw new Error("Native lint producer selection is incomplete");
    const directory = path.relative(
      fs.realpathSync.native(sourceRoot),
      fs.realpathSync.native(record.Dir),
    );
    if (
      path.isAbsolute(directory) ||
      directory === ".." ||
      directory.startsWith(".." + path.sep)
    )
      throw new Error("Native lint producer selection escapes its package");
    const names = (field: keyof IGoPackageSelection): string[] => {
      const value = record[field];
      if (value === undefined) return [];
      if (
        !Array.isArray(value) ||
        value.some(
          (name) =>
            typeof name !== "string" ||
            !name ||
            path.isAbsolute(name) ||
            name.split(/[\\/]/).some((part) => part === ".." || part === "."),
        )
      )
        throw new Error(
          "Native lint producer selection has an invalid source name",
        );
      return value as string[];
    };
    const protectedFiles = new Set([
      ...names("GoFiles"),
      ...names("CgoFiles"),
      ...names("EmbedFiles"),
    ]);
    for (const name of [...names("TestGoFiles"), ...names("XTestGoFiles")])
      if (!protectedFiles.has(name))
        excluded.add(path.join(directory, name).split(path.sep).join("/"));
  }
  return {
    excludedGoTestFiles: [...excluded].sort(),
    metadata: JSON.parse(JSON.stringify(records)),
  };
}

function readGoSelection(sourceRoot: string): INativeLintSourceSelection {
  const { resolveGoCompiler } = TestProject.REQUIRE_FROM_TEST(
    path.join(
      TestProject.WORKSPACE_ROOT,
      "packages/ttsc/lib/plugin/internal/source/resolveGoCompiler.js",
    ),
  ) as {
    resolveGoCompiler: (env: NodeJS.ProcessEnv) => { binary: string };
  };
  const binary = resolveGoCompiler(process.env).binary;
  const collect = (env: NodeJS.ProcessEnv): IGoPackageSelection[] => {
    // -find asks Go to select package files without resolving imports. Dependency
    // availability is subsequently proved by the actual native compiler build.
    const result = E2eProcessTrace.spawnSync(
      binary,
      ["list", "-find", "-e", "-json", "./..."],
      {
        cwd: sourceRoot,
        env,
        encoding: "utf8",
        maxBuffer: 32 * 1024 * 1024,
      },
    );
    if (result.error || result.status !== 0 || result.stderr.trim())
      throw new Error(
        `Native lint producer Go selection failed: ${result.error?.message ?? result.stderr}`,
      );
    const records: IGoPackageSelection[] = [];
    let depth = 0,
      quoted = false,
      escaped = false,
      start = 0;
    for (let index = 0; index < result.stdout.length; ++index) {
      const character = result.stdout[index]!;
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === "{") {
        if (depth++ === 0) start = index;
      } else if (character === "}") {
        if (--depth < 0)
          throw new Error(
            "Native lint producer Go selection returned malformed JSON",
          );
        if (depth === 0)
          records.push(JSON.parse(result.stdout.slice(start, index + 1)));
      } else if (depth === 0 && !/\s/.test(character))
        throw new Error(
          "Native lint producer Go selection returned malformed JSON",
        );
    }
    if (depth || quoted)
      throw new Error(
        "Native lint producer Go selection returned truncated JSON",
      );
    return records;
  };
  const inherited = collect(process.env);
  const isolated = collect({ ...process.env, GOWORK: "off", GOPROXY: "off" });
  const project = (records: IGoPackageSelection[]) =>
    records.map((record) => ({
      Dir: record.Dir,
      GoFiles: record.GoFiles,
      CgoFiles: record.CgoFiles,
      TestGoFiles: record.TestGoFiles,
      XTestGoFiles: record.XTestGoFiles,
      EmbedFiles: record.EmbedFiles,
      Error: record.Error,
      DepsErrors: record.DepsErrors,
      Incomplete: record.Incomplete,
      InvalidGoFiles: record.InvalidGoFiles,
    }));
  const selected = selectNativeLintSourceFiles(sourceRoot, project(inherited));
  selectNativeLintSourceFiles(sourceRoot, project(isolated));
  if (JSON.stringify(project(inherited)) !== JSON.stringify(project(isolated)))
    throw new Error(
      "Native lint producer selection differs across workspace/proxy environments",
    );
  return { ...selected, environment: readSelectionEnvironment() };
}

function readSelectionEnvironment(): Record<string, string | null> {
  return Object.fromEntries(
    [
      "GOOS",
      "GOARCH",
      "CGO_ENABLED",
      "GOFLAGS",
      "GOWORK",
      "GOTOOLCHAIN",
      "GOROOT",
      "GOPROXY",
      "TTSC_GO_BINARY",
    ].map((name) => [name, process.env[name] ?? null]),
  );
}

/**
 * Link the requested real package and refuse an existing unrelated occupant.
 *
 * @evidence contracts/common.md#principled-implementation Existing entries are reusable only when they are actual links whose resolved target equals the requested package; files, directories and foreign producer links are refused.
 * @evidence contracts/common.md#clear-and-simple-design One native-link operation is shared by corpus and TestLint fixture builders, with platform link type selected at its filesystem boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts EEXIST does not authorize a different package, and no entry is removed or replaced to disguise a conflicting identity.
 * @evidence contracts/common.md#meaningful-documentation States the precise existing-link admission contract and the foreign occupant refusal.
 *
 * @evidence contracts/portability.md#os-neutral-implementation Native directory symlinks or Windows junctions identify the package; EEXIST admission compares actual resolved targets rather than path casing.
 * @evidence contracts/performance.md#efficient-algorithms One creation attempt and, on EEXIST, native link and realpath observations require no package-tree traversal.
 * @evidence contracts/performance.md#reuse-equivalent-work An existing link is reusable only if its actual target equals the requested producer; unrelated occupants fail without replacement.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The fixture caller owns the created link and later tree cleanup. Synchronous filesystem calls leave no retained handle or task.
 */
export function linkNativeLintPackage(packageRoot: string, link: string): void {
  try {
    fs.symlinkSync(
      packageRoot,
      link,
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (
      !fs.lstatSync(link).isSymbolicLink() ||
      fs.realpathSync.native(link) !== fs.realpathSync.native(packageRoot)
    )
      throw new Error(
        "Existing native lint package link does not identify the requested producer",
      );
  }
}
