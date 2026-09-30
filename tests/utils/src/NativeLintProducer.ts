import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { TestProject } from "./TestProject";

export interface INativeLintProducer {
  readonly packageRoot: string;
  readonly sourceRoot: string;
  readonly manifestPath: string;
  readonly manifestSha256: string;
}

interface IFileReading {
  name: string;
  bytes: number;
  mode: number;
  sha256: string;
}

export interface INativeLintSourceSelection {
  readonly excludedGoTestFiles: readonly string[];
  readonly metadata: readonly unknown[];
  readonly environment?: Readonly<Record<string, string | null>>;
}

let sharedProducer: INativeLintProducer | undefined;

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
 * changed selection environment, bytes, manifest or installation link.
 *
 * @evidence contracts/common.md#principled-implementation The shared producer is published only after independent before/copy/after content readings agree; changing authored input is refused rather than accepted under an earlier identity.
 * @evidence contracts/common.md#clear-and-simple-design One process-owned package snapshot and manifest serve explicitly opted-in consumers; cold and source-mutating callers keep the workspace package.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Consumers resolve a real copied package and installation link; no loader, capability, compiler, source digest or cache proof is replaced.
 * @evidence contracts/common.md#meaningful-documentation Documents the package-byte capture scope and leaves external installation, SDK and toolchain proof with the actual production build.
 */
export function getNativeLintProducer(): INativeLintProducer {
  if (!sharedProducer) {
    const sourceRoot = path.join(TestProject.WORKSPACE_ROOT, "packages", "lint");
    const destinationRoot = TestProject.tmpdir("ttsc-native-lint-producer-");
    const selection = readGoSelection(sourceRoot);
    sharedProducer = captureNativeLintProducer({ sourceRoot, destinationRoot, selection });
  }
  const manifest = fs.readFileSync(sharedProducer.manifestPath);
  const saved = JSON.parse(manifest.toString());
  if (saved.selection?.environment && JSON.stringify(saved.selection.environment) !== JSON.stringify(readSelectionEnvironment()))
    throw new Error("Shared native lint producer selection environment was modified");
  const installed = path.join(sharedProducer.packageRoot, "node_modules");
  if (saved.installation === null && fs.lstatSync(installed, { throwIfNoEntry: false }))
    throw new Error("Shared native lint producer installation link was modified");
  if (saved.installation !== null && (!fs.lstatSync(installed).isSymbolicLink() ||
      fs.realpathSync.native(installed) !== saved.installation))
    throw new Error("Shared native lint producer installation link was modified");
  if (crypto.createHash("sha256").update(manifest).digest("hex") !== sharedProducer.manifestSha256 ||
      JSON.stringify(readPackage(sharedProducer.packageRoot)) !== JSON.stringify(JSON.parse(manifest.toString()).files))
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
 * installation whose validity remains the native build's responsibility.
 * The optional file copier is the explicit byte-copy boundary, allowing its
 * caller to verify corruption and concurrent-edit refusals without replacing
 * filesystem globals. Private enumeration and hashing implement this operation.
 *
 * @evidence contracts/common.md#principled-implementation A sorted path/length/mode/SHA population must agree before capture, in the actual copy and after capture; package metadata must name the real lint package and a failed capture returns no producer.
 * @evidence contracts/common.md#clear-and-simple-design Enumeration, copying and proof comparison are sequential and call-local, with a sibling manifest outside the compiled package input tree.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Reads every selected byte instead of trusting mtimes, forbids unexplained source links and retains production dependency/toolchain/cache guards; the copier cannot bypass the proof comparisons.
 * @evidence contracts/common.md#meaningful-documentation Documents the empty destination precondition, explicit copy boundary, manifest scope, installation link and refusal behavior.
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
    throw new Error("Native lint producer capture requires an empty destination");
  const selection = props.selection ? selectNativeLintSourceFiles(sourceRoot,
    props.selection.metadata as IGoPackageSelection[]) : undefined;
  if (selection && JSON.stringify(selection.excludedGoTestFiles) !== JSON.stringify(props.selection!.excludedGoTestFiles))
    throw new Error("Native lint producer selection proof does not match its excluded files");
  const omitted = new Set(selection?.excludedGoTestFiles ?? []);
  const before = readPackage(sourceRoot, omitted);
  const packageRoot = path.join(destinationRoot, "lint");
  fs.mkdirSync(packageRoot);
  for (const file of before) {
    const target = path.join(packageRoot, ...file.name.split("/"));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    (props.copyFile ?? fs.copyFileSync)(path.join(sourceRoot, ...file.name.split("/")), target);
    fs.chmodSync(target, file.mode);
  }
  const copied = readPackage(packageRoot);
  const after = readPackage(sourceRoot, omitted);
  const expected = JSON.stringify(before);
  if (JSON.stringify(after) !== expected || JSON.stringify(copied) !== expected)
    throw new Error("Native lint producer changed during capture or its copied bytes differ");
  const metadata = JSON.parse(fs.readFileSync(path.join(packageRoot, "package.json"), "utf8"));
  if (metadata.name !== "@ttsc/lint")
    throw new Error("Native lint producer capture requires the authored @ttsc/lint package");
  const installation = path.join(sourceRoot, "node_modules");
  if (fs.existsSync(installation))
    fs.symlinkSync(fs.realpathSync.native(installation), path.join(packageRoot, "node_modules"),
      process.platform === "win32" ? "junction" : "dir");
  const manifest = JSON.stringify({
    sourceRoot,
    installation: fs.existsSync(installation) ? fs.realpathSync.native(installation) : null,
    files: before,
    selection: selection ? { ...selection, environment: props.selection?.environment } : null,
  }, null, 2) + "\n";
  const manifestPath = path.join(destinationRoot, "manifest.json");
  fs.writeFileSync(manifestPath, manifest);
  return Object.freeze({ packageRoot, sourceRoot, manifestPath,
    manifestSha256: crypto.createHash("sha256").update(manifest).digest("hex") });
}

function readPackage(root: string, omitted: ReadonlySet<string> = new Set()): IFileReading[] {
  const files: IFileReading[] = [];
  const visit = (directory: string): void => {
    for (const name of fs.readdirSync(directory).sort()) {
      if (directory === root && ["node_modules", ".git", ".cache", ".ttsc"].includes(name)) continue;
      const file = path.join(directory, name);
      const stat = fs.lstatSync(file);
      if (stat.isSymbolicLink())
        throw new Error(`Native lint producer has an unaccounted source link: ${file}`);
      if (stat.isDirectory()) visit(file);
      else if (stat.isFile()) {
        const relative = path.relative(root, file).split(path.sep).join("/");
        if (omitted.has(relative)) continue;
        const content = fs.readFileSync(file);
        files.push({ name: path.relative(root, file).split(path.sep).join("/"),
          bytes: content.length, mode: stat.mode & 0o777,
          sha256: crypto.createHash("sha256").update(content).digest("hex") });
      } else throw new Error(`Native lint producer has an unsupported source entry: ${file}`);
    }
  };
  visit(root);
  return files.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
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
 */
export function selectNativeLintSourceFiles(sourceRoot: string, records: readonly IGoPackageSelection[]): INativeLintSourceSelection {
  if (records.length === 0) throw new Error("Native lint producer selection has no packages");
  const excluded = new Set<string>();
  for (const record of records) {
    if (!record || typeof record.Dir !== "string" || record.Error || record.Incomplete ||
        (record.DepsErrors?.length ?? 0) || (record.InvalidGoFiles?.length ?? 0))
      throw new Error("Native lint producer selection is incomplete");
    const directory = path.relative(fs.realpathSync.native(sourceRoot), fs.realpathSync.native(record.Dir));
    if (path.isAbsolute(directory) || directory === ".." || directory.startsWith(".." + path.sep))
      throw new Error("Native lint producer selection escapes its package");
    const names = (field: keyof IGoPackageSelection): string[] => {
      const value = record[field];
      if (value === undefined) return [];
      if (!Array.isArray(value) || value.some((name) => typeof name !== "string" ||
          !name || path.isAbsolute(name) || name.split(/[\\/]/).some((part) => part === ".." || part === ".")))
        throw new Error("Native lint producer selection has an invalid source name");
      return value as string[];
    };
    const protectedFiles = new Set([...names("GoFiles"), ...names("CgoFiles"), ...names("EmbedFiles")]);
    for (const name of [...names("TestGoFiles"), ...names("XTestGoFiles")])
      if (!protectedFiles.has(name)) excluded.add(path.join(directory, name).split(path.sep).join("/"));
  }
  return { excludedGoTestFiles: [...excluded].sort(), metadata: JSON.parse(JSON.stringify(records)) };
}

function readGoSelection(sourceRoot: string): INativeLintSourceSelection {
  const { resolveGoCompiler } = TestProject.REQUIRE_FROM_TEST(path.join(TestProject.WORKSPACE_ROOT,
    "packages/ttsc/lib/plugin/internal/source/resolveGoCompiler.js")) as {
      resolveGoCompiler: (env: NodeJS.ProcessEnv) => { binary: string };
    };
  const binary = resolveGoCompiler(process.env).binary;
  const collect = (env: NodeJS.ProcessEnv): IGoPackageSelection[] => {
    // -find asks Go to select package files without resolving imports. Dependency
    // availability is subsequently proved by the actual native compiler build.
    const result = spawnSync(binary, ["list", "-find", "-e", "-json", "./..."], {
      cwd: sourceRoot, env, encoding: "utf8", maxBuffer: 32 * 1024 * 1024,
    });
    if (result.error || result.status !== 0 || result.stderr.trim())
      throw new Error(`Native lint producer Go selection failed: ${result.error?.message ?? result.stderr}`);
    const records: IGoPackageSelection[] = [];
    let depth = 0, quoted = false, escaped = false, start = 0;
    for (let index = 0; index < result.stdout.length; ++index) {
      const character = result.stdout[index]!;
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') quoted = false;
      } else if (character === '"') quoted = true;
      else if (character === "{") { if (depth++ === 0) start = index; }
      else if (character === "}") {
        if (--depth < 0) throw new Error("Native lint producer Go selection returned malformed JSON");
        if (depth === 0) records.push(JSON.parse(result.stdout.slice(start, index + 1)));
      } else if (depth === 0 && !/\s/.test(character))
        throw new Error("Native lint producer Go selection returned malformed JSON");
    }
    if (depth || quoted) throw new Error("Native lint producer Go selection returned truncated JSON");
    return records;
  };
  const inherited = collect(process.env);
  const isolated = collect({ ...process.env, GOWORK: "off", GOPROXY: "off" });
  const project = (records: IGoPackageSelection[]) => records.map((record) => ({
    Dir: record.Dir, GoFiles: record.GoFiles, CgoFiles: record.CgoFiles,
    TestGoFiles: record.TestGoFiles, XTestGoFiles: record.XTestGoFiles, EmbedFiles: record.EmbedFiles,
    Error: record.Error, DepsErrors: record.DepsErrors, Incomplete: record.Incomplete,
    InvalidGoFiles: record.InvalidGoFiles,
  }));
  const selected = selectNativeLintSourceFiles(sourceRoot, project(inherited));
  selectNativeLintSourceFiles(sourceRoot, project(isolated));
  if (JSON.stringify(project(inherited)) !== JSON.stringify(project(isolated)))
    throw new Error("Native lint producer selection differs across workspace/proxy environments");
  return { ...selected, environment: readSelectionEnvironment() };
}

function readSelectionEnvironment(): Record<string, string | null> {
  return Object.fromEntries(["GOOS", "GOARCH", "CGO_ENABLED", "GOFLAGS", "GOWORK", "GOTOOLCHAIN", "GOROOT",
    "GOPROXY", "TTSC_GO_BINARY"].map((name) => [name, process.env[name] ?? null]));
}

/**
 * Link the requested real package and refuse an existing unrelated occupant.
 *
 * @evidence contracts/common.md#principled-implementation Existing entries are reusable only when they are actual links whose resolved target equals the requested package; files, directories and foreign producer links are refused.
 * @evidence contracts/common.md#clear-and-simple-design One native-link operation is shared by corpus and TestLint fixture builders, with platform link type selected at its filesystem boundary.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts EEXIST does not authorize a different package, and no entry is removed or replaced to disguise a conflicting identity.
 * @evidence contracts/common.md#meaningful-documentation States the precise existing-link admission contract and the foreign occupant refusal.
 */
export function linkNativeLintPackage(packageRoot: string, link: string): void {
  try {
    fs.symlinkSync(packageRoot, link, process.platform === "win32" ? "junction" : "dir");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    if (!fs.lstatSync(link).isSymbolicLink() || fs.realpathSync.native(link) !== fs.realpathSync.native(packageRoot))
      throw new Error("Existing native lint package link does not identify the requested producer");
  }
}
