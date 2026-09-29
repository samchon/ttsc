import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ITtscBannerPluginConfig } from "./structures";

export * from "./structures/index";

/**
 * The shape returned by a ttsc plugin factory function.
 *
 * Mirrors the ttsc plugin descriptor contract. The `source` field points to the
 * Go source directory that the host will compile and cache as either an
 * executable sidecar or linked native source.
 */
type TtscPluginDescriptor = {
  /** Universal config-discovery inputs consumed by the native transform. */
  hostInputs?: string[];
  /** Evaluation-time fingerprints paired with {@link hostInputs}. */
  hostInputHashes?: Record<string, string | null>;
  /** Evaluation-time physical targets paired with {@link hostInputs}. */
  hostInputRealpaths?: Record<string, string | null>;
  /** Human-readable plugin name used in logs and error messages. */
  name: string;
  /** Absolute path to the Go source directory for this plugin. */
  source: string;
  /**
   * Pipeline stage. `"transform"` plugins may rewrite source files; `"check"`
   * plugins only produce diagnostics. The framework default is `"transform"`.
   */
  stage?: "check" | "transform";
};

/**
 * Context object passed by the ttsc host to every plugin factory function.
 *
 * The factory may inspect the context to customise the descriptor — for example
 * selecting a different Go source directory based on `plugin` config — but most
 * factories ignore it.
 */
type TtscPluginFactoryContext<TConfig> = {
  /** Absolute path to the selected ttsc native helper, not a plugin binary. */
  binary: string;
  /** Working directory of the ttsc invocation. */
  cwd: string;
  /**
   * Absolute path to the directory holding this descriptor module — the
   * load-mode-independent replacement for `__dirname`.
   */
  dirname: string;
  /**
   * Absolute path to this descriptor module — the load-mode-independent
   * replacement for `__filename`.
   */
  filename: string;
  /** Host-declared anchor for implicit plugin config discovery. */
  pluginConfigDir?: string;
  /** The raw plugin entry from `compilerOptions.plugins[]`. */
  plugin: TConfig;
  /** Absolute path to the project root (directory containing tsconfig). */
  projectRoot: string;
  /** Absolute path to the resolved tsconfig. */
  tsconfig: string;
};

/**
 * Keys that the ttsc plugin host injects into every plugin entry and are not
 * owned by `@ttsc/banner`. These pass through the factory without validation so
 * the host can freely add new framework keys in the future.
 */
const FRAMEWORK_KEYS = new Set<string>([
  "enabled",
  "name",
  "stage",
  "transform",
]);

/**
 * Plugin factory for `@ttsc/banner` — called by the ttsc host to obtain the
 * plugin descriptor.
 *
 * The only banner-specific key accepted in the tsconfig plugin entry is
 * `configFile`. Any other key that is not a known framework key is rejected
 * with a specific error so users discover the correct configuration surface
 * (the dedicated config file) rather than silently receiving no banner.
 *
 * @evidence contracts/common.md#standard-implementation-practices
 *   The host's default-export factory protocol supplies module and project
 *   anchors. Node path/fs/crypto APIs produce a native driver descriptor and
 *   config observations; the Go driver owns evaluation and transformation.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Framework keys, candidate filenames, package identity and stage come from
 *   the registration contract. Discovery records absent candidates rather than
 *   compensating for them with a fabricated config. Native config evaluation
 *   still reaches the shared recorder's private resolver fallback; that
 *   owning-layer limitation is not certified away by this descriptor.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates registration from config evaluation and explains why
 *   unknown inline keys are rejected. Context and descriptor fields document
 *   host anchoring and observed inputs. Paragraphs and reasons follow the
 *   documentation skill; the exported factory is documented as a host entry.
 *
 * @evidence contracts/portability.md#os-neutral-implementation
 *   Node path operations resolve the host's explicit anchors and terminate
 *   ancestor discovery at the native root. Filesystem reads distinguish
 *   directory markers, readable bytes and unresolved physical targets, without
 *   applying OS-wide case folding or constructing shell commands.
 *
 * @evidence contracts/performance.md#efficient-algorithms
 *   Discovery checks the fixed candidate set once per ancestor and stops at
 *   the first matching directory. Explicit config paths limit work to one
 *   candidate; hashing reads its content because the host needs a content
 *   observation, not only an existence flag.
 *
 * @evidence contracts/performance.md#reuse-equivalent-work
 *   The descriptor returns hashes and physical targets with the observed
 *   paths so the host can reuse evaluation under its module/input contract.
 *   The factory collects observations once for the returned descriptor; it
 *   does not reevaluate the native configuration for each emitted file.
 *
 * @evidence contracts/performance.md#bound-retention-and-release-resources
 *   Candidate arrays and maps belong to one returned descriptor. Synchronous
 *   reads close their handles internally; no watcher or child process is
 *   retained by this factory. The host owns the descriptor's cached lifetime.
 */
export default function createTtscBanner(
  context: TtscPluginFactoryContext<ITtscBannerPluginConfig>,
): TtscPluginDescriptor {
  const entry = context.plugin as Record<string, unknown>;
  for (const key of Object.keys(entry)) {
    if (!FRAMEWORK_KEYS.has(key) && key !== "configFile") {
      throw new Error(
        `@ttsc/banner: tsconfig plugin entry contains unsupported key ${JSON.stringify(key)}. ` +
          `Banner options must be placed in a banner.config.{ts,cts,mts,js,cjs,mjs,json} file. ` +
          `The only accepted key in the tsconfig entry is "configFile" (optional path to the config file).`,
      );
    }
  }

  const configInputs = bannerConfigInputs(context);
  return {
    hostInputHashes: configInputs.hashes,
    hostInputRealpaths: configInputs.realpaths,
    hostInputs: configInputs.inputs,
    name: "@ttsc/banner",
    // Point at the `driver/` directory one level above `lib/` in the
    // installed package tree (where the Go sources live). `context.dirname`
    // is this descriptor's own directory in every load mode, unlike the
    // CommonJS `__dirname`, which is undefined under a `.ts`-source or ESM load.
    source: path.resolve(context.dirname, "..", "driver"),
    stage: "transform",
  };
}

const BANNER_CONFIG_FILENAMES = [
  "banner.config.json",
  "banner.config.js",
  "banner.config.cjs",
  "banner.config.mjs",
  "banner.config.ts",
  "banner.config.cts",
  "banner.config.mts",
];

/** Mirror native config resolution while retaining missing priority probes. */
function bannerConfigInputs(
  context: TtscPluginFactoryContext<ITtscBannerPluginConfig>,
): {
  hashes: Record<string, string | null>;
  inputs: string[];
  realpaths: Record<string, string | null>;
} {
  const configFile = (context.plugin as { configFile?: unknown }).configFile;
  const base = path.resolve(
    context.pluginConfigDir ?? path.dirname(context.tsconfig),
  );
  if (typeof configFile === "string" && configFile.trim() !== "") {
    const file = path.isAbsolute(configFile)
      ? path.resolve(configFile)
      : path.resolve(base, configFile);
    return {
      hashes: { [file]: hostInputHash(file) },
      inputs: [file],
      realpaths: { [file]: hostInputRealpath(file) },
    };
  }
  return configDiscoveryInputs(base, BANNER_CONFIG_FILENAMES);
}

function configDiscoveryInputs(
  base: string,
  names: readonly string[],
): {
  hashes: Record<string, string | null>;
  inputs: string[];
  realpaths: Record<string, string | null>;
} {
  const inputs: string[] = [];
  const hashes: Record<string, string | null> = {};
  const realpaths: Record<string, string | null> = {};
  for (let directory = base; ; directory = path.dirname(directory)) {
    const candidates = names.map((name) => path.join(directory, name));
    inputs.push(...candidates);
    for (const candidate of candidates) {
      hashes[candidate] = hostInputHash(candidate);
      realpaths[candidate] = hostInputRealpath(candidate);
    }
    if (candidates.some(configCandidateExists)) break;
    const parent = path.dirname(directory);
    if (parent === directory) break;
  }
  return { hashes, inputs, realpaths };
}

function hostInputRealpath(file: string): string | null {
  try {
    return fs.realpathSync.native(file);
  } catch {
    return null;
  }
}

/** Hash the exact candidate state observed before discovery selects a file. */
function hostInputHash(file: string): string | null {
  try {
    if (fs.statSync(file).isDirectory()) {
      return crypto
        .createHash("sha256")
        .update("ttsc:host-input:directory\0")
        .digest("hex");
    }
    return crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
  } catch {
    return null;
  }
}

/** Match the native discovery rule: a directory is never a config file. */
function configCandidateExists(file: string): boolean {
  try {
    return !fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}
