import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { ITtscBannerPluginConfig } from "./structures";

/**
 * The shape returned by a ttsc plugin factory function.
 *
 * Mirrors the ttsc plugin descriptor contract. The `source` field points to the
 * Go source directory that the host will compile and cache as either an
 * executable sidecar or linked native source.
 */
type TtscPluginDescriptor = {
  /** The bundled driver host records actual writes and their physical sources. */
  capabilities: { emitProvenance: true };

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
 * Module anchors locate shipped Go source. Project anchors locate user
 * configuration, including when the host uses a generated wrapper tsconfig.
 */
type TtscPluginFactoryContext<TConfig> = {
  /** Absolute path to the selected ttsc native helper, not a plugin binary. */
  binary: string;

  /** Working directory of the ttsc invocation. */
  cwd: string;

  /**
   * Absolute path to the directory holding this descriptor module, the
   * load-mode-independent replacement for `__dirname`.
   */
  dirname: string;

  /**
   * Absolute path to this descriptor module, the load-mode-independent
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
 * owned by `@ttsc/banner`. The host validates registration; this factory
 * rejects unknown banner options without rejecting those registration keys.
 */
const FRAMEWORK_KEYS = new Set<string>([
  "enabled",
  "name",
  "stage",
  "transform",
]);

/**
 * Plugin factory called by the ttsc host to obtain the `@ttsc/banner` descriptor.
 *
 * The only banner-specific key accepted in the tsconfig plugin entry is
 * `configFile`. Any other key that is not a known framework key is rejected
 * with a specific error so users discover the correct configuration surface
 * (the dedicated config file) rather than silently receiving no banner.
 *
 * @evidence contracts/common.md#principled-implementation
 *   The default-export factory maps host module anchors to the shipped driver
 *   and project anchors to config candidates. Discovery records all seven
 *   candidate names in every directory from the anchor through the first one
 *   holding a non-directory match, including absent paths and directory markers,
 *   so creating a nearer config or a second file beside the match changes the
 *   descriptor inputs. Native evaluation validates ambiguous or invalid config;
 *   this factory supplies observations rather than treating existence as a
 *   valid banner. SHA-256 covers candidate bytes and a distinct directory marker.
 *
 * @evidence contracts/common.md#clear-and-simple-design
 *   Registration validation, discovery observations and descriptor construction
 *   have separate responsibilities. Private helpers isolate path discovery and
 *   filesystem observations; they do not implement another config evaluator.
 *   The driver path follows the installed package layout, while config anchors
 *   follow the project because those two directories have different owners.
 *
 * @evidence contracts/common.md#prohibited-implementation-shortcuts
 *   Framework keys, candidate filenames, package identity and stage encode the
 *   supported registration contract. The descriptor neither evaluates user
 *   JavaScript nor changes a foreign loader; it records a failed probe (an absent
 *   or unreadable candidate) as a null hash or physical target, and native
 *   evaluation reports the actual error.
 *
 * @evidence contracts/common.md#meaningful-documentation
 *   JSDoc separates registration from config evaluation and explains why
 *   unknown inline keys are rejected. Context and descriptor fields document
 *   host anchoring and observed inputs. Paragraphs and reasons follow the
 *   documentation skill; the exported factory is documented as a host entry.
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
    capabilities: { emitProvenance: true },
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

/**
 * Mirror native config resolution for a nonblank string `configFile` or for
 * upward discovery, retaining the absent candidates that could supersede or
 * make ambiguous the match. Native evaluation rejects any other `configFile`.
 */
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
