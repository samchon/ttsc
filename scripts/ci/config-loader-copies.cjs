// Hold the three Go copies of the plugin config loader's toolchain layer
// identical, and fail by name the day one of them drifts.
//
// ## What this guards
//
// `@ttsc/lint`, `@ttsc/banner` and `@ttsc/strip` each evaluate a user-written
// `*.config.{ts,cts,mts,js,cjs,mjs,json}` file, and each carries its own
// wholesale copy of the layer underneath that evaluation: where the ephemeral
// loader tree is created, how a linked `node_modules` is chased, which
// `module` the loader tsconfig gets, and — since #1157 — which `ttsx` launcher
// and which native compiler the loader spawns. The copies live in
//
//   - packages/lint/linthost/config.go   (the reference implementation)
//   - packages/banner/driver/banner.go
//   - packages/strip/driver/config.go
//
// each between a `ttsc:config-loader-shared begin` / `end` marker pair.
//
// ## Why there is a gate instead of one implementation (#1169)
//
// The duplication is real and was priced twice: #1157 fixed the launcher and
// compiler resolution in `@ttsc/lint`, and #1164 had to be filed a full cycle
// later to write the same fix into `@ttsc/banner` and `@ttsc/strip`. #1169
// asked for the home first and the extraction second, and the answer is that
// there is no home worth the contract:
//
//  1. The only home all three could share is `packages/ttsc/driver`, the
//     public seam third-party plugins compile against. `driver/windowsjunction`
//     is precedent for an OS primitive with no policy in it; a *toolchain
//     resolution policy* published there becomes a permanent public contract
//     that outlives every reason it was introduced for.
//  2. `packages/lint`'s go.mod deliberately carries no requirement on the
//     in-tree `packages/ttsc` module, with its reason written in the manifest
//     and again in `packages/lint/linthost/host.go`: that module has no public
//     version tag and resolves only through ttsc's runtime-generated go.work
//     overlay. A `driver` home would serve two of the three modules cleanly
//     and the third by exception.
//  3. The three loaders are not one loader. `@ttsc/lint` evaluates a config
//     *graph* — extends chains, dependency fingerprints, a two-tier disk cache,
//     watch inputs — and reads its loader's result from a file; the other two
//     evaluate one object and read stdout. Only the layer between the markers
//     is genuinely common, and extracting just that layer creates a fourth
//     structural pattern without removing a single one of the three loaders.
//
// So the copies stay, and what changes is that they are no longer held
// together by a comment asking the next author to remember. Every function
// between the markers is compared here on every pull request. Editing one copy
// and not the others fails, and the failure names the copies still carrying the
// old shape.
//
// ## The comparison
//
// Compared: the code. Comments are dropped, whitespace is collapsed, the
// copy's own `@ttsc/<pkg>:` error prefix is canonicalized, and each copy's
// identifiers are mapped onto the canonical names in `SHARED` — `@ttsc/strip`
// spells every symbol with a `strip` prefix, which is a naming choice and not
// a behavioral one.
//
// Not compared: doc comments and reasoning comments, which are free to name
// their own package, their own issue numbers, and their own callers.
//
// ## Changing the shared block
//
// - Change the code in all three copies, or the gate fails.
// - Add a shared function to all three copies AND to `SHARED`, or the gate
//   fails: an undeclared function inside a region is an error, so a new helper
//   cannot arrive in one copy alone.
// - A function that genuinely belongs to only some copies is declared with an
//   `absent` reason per copy that lacks it. Silence is not available.
// - Anything package-specific belongs outside the markers.

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");

const BEGIN_MARKER = "// ttsc:config-loader-shared begin";
const END_MARKER = "// ttsc:config-loader-shared end";

/** The three Go copies, reference first. */
const COPIES = {
  lint: { file: "packages/lint/linthost/config.go", package: "@ttsc/lint" },
  banner: { file: "packages/banner/driver/banner.go", package: "@ttsc/banner" },
  strip: { file: "packages/strip/driver/config.go", package: "@ttsc/strip" },
};

const COPY_IDS = Object.keys(COPIES);

/** The canonical error prefix every copy's own package name is mapped onto. */
const CANONICAL_PACKAGE = "@ttsc/<pkg>";

/**
 * Every function inside the shared regions.
 *
 * `symbols` maps a copy id to the identifier that copy uses. `absent` maps a
 * copy id to the reason it does not carry the function at all; a copy listed in
 * neither is a failure, so a deletion cannot pass as an omission.
 */
const SHARED = [
  {
    name: "configModuleOption",
    symbols: {
      lint: "configModuleOption",
      banner: "configModuleOption",
      strip: "stripConfigModuleOption",
    },
  },
  {
    name: "nearestPackageType",
    symbols: {
      lint: "nearestPackageType",
      banner: "nearestPackageType",
      strip: "stripNearestPackageType",
    },
  },
  {
    name: "loaderRootDir",
    symbols: {
      lint: "loaderRootDir",
      banner: "loaderRootDir",
      strip: "stripLoaderRootDir",
    },
  },
  {
    name: "loaderTempBase",
    symbols: {
      lint: "loaderTempBase",
      banner: "loaderTempBase",
      strip: "stripLoaderTempBase",
    },
  },
  {
    name: "resolveDirLink",
    symbols: {
      lint: "resolveDirLink",
      banner: "resolveDirLink",
      strip: "stripResolveDirLink",
    },
  },
  {
    name: "realpathIfPossible",
    symbols: {
      lint: "realpathIfPossible",
      banner: "realpathIfPossible",
      strip: "stripRealpathIfPossible",
    },
  },
  {
    name: "configToolAnchors",
    symbols: {
      lint: "configToolAnchors",
      banner: "configToolAnchors",
      strip: "stripConfigToolAnchors",
    },
  },
  {
    name: "resolveConfigTsgo",
    symbols: {
      lint: "resolveConfigTsgo",
      banner: "resolveConfigTsgo",
      strip: "stripResolveConfigTsgo",
    },
  },
  {
    name: "tsgoBinaryFrom",
    symbols: {
      lint: "tsgoBinaryFrom",
      banner: "tsgoBinaryFrom",
      strip: "stripTsgoBinaryFrom",
    },
  },
  {
    name: "resolveTtsxLauncher",
    symbols: {
      lint: "resolveTtsxLauncher",
      banner: "resolveTtsxLauncher",
      strip: "stripResolveTtsxLauncher",
    },
  },
  {
    name: "ttsxLauncherFrom",
    symbols: {
      lint: "ttsxLauncherFrom",
      banner: "ttsxLauncherFrom",
      strip: "stripTtsxLauncherFrom",
    },
  },
  {
    name: "nodePackageManifestFrom",
    symbols: {
      lint: "nodePackageManifestFrom",
      banner: "nodePackageManifestFrom",
      strip: "stripNodePackageManifestFrom",
    },
  },
  {
    name: "nodePlatformPair",
    symbols: {
      lint: "nodePlatformPair",
      banner: "nodePlatformPair",
      strip: "stripNodePlatformPair",
    },
  },
  {
    name: "nodePlatformPairFor",
    symbols: {
      lint: "nodePlatformPairFor",
      banner: "nodePlatformPairFor",
      strip: "stripNodePlatformPairFor",
    },
  },
  {
    name: "ttsxCommand",
    symbols: { lint: "ttsxCommand", banner: "ttsxCommand" },
    absent: {
      strip:
        "@ttsc/strip's loader only ever spawns the launcher under a cancellable " +
        "context, so the background-context wrapper would be unreachable code there.",
    },
  },
  {
    name: "ttsxCommandContext",
    symbols: {
      lint: "ttsxCommandContext",
      banner: "ttsxCommandContext",
      strip: "stripTtsxCommandContext",
    },
  },
  {
    name: "shouldRunTtsxThroughNode",
    symbols: {
      lint: "shouldRunTtsxThroughNode",
      banner: "shouldRunTtsxThroughNode",
      strip: "stripShouldRunThroughNode",
    },
  },
  {
    name: "nodeConfigLoaderEnv",
    symbols: {
      lint: "nodeConfigLoaderEnv",
      banner: "nodeConfigLoaderEnv",
      strip: "stripNodeConfigLoaderEnv",
    },
  },
  {
    name: "linkNearestNodeModules",
    symbols: {
      lint: "linkNearestNodeModules",
      banner: "linkNearestNodeModules",
      strip: "stripLinkNearestNodeModules",
    },
  },
  {
    name: "createWindowsJunction",
    symbols: {
      lint: "createWindowsJunction",
      banner: "createWindowsJunction",
      strip: "stripCreateWindowsJunction",
    },
  },
  {
    name: "findNearestNodeModules",
    symbols: {
      lint: "findNearestNodeModules",
      banner: "findNearestNodeModules",
      strip: "stripFindNearestNodeModules",
    },
  },
  {
    name: "relativeImportSpecifier",
    symbols: {
      banner: "relativeImportSpecifier",
      strip: "stripRelativeImportSpecifier",
    },
    absent: {
      lint:
        "@ttsc/lint's loader imports its config through an absolute file URL " +
        "(fileURL) rather than a relative specifier, so it computes none.",
    },
  },
  {
    name: "setEnv",
    symbols: { lint: "setEnv", banner: "setEnv", strip: "stripSetEnv" },
  },
  {
    name: "loaderFailureReason",
    symbols: { banner: "loaderFailureReason", strip: "loaderFailureReason" },
    absent: {
      lint:
        "@ttsc/lint's loader writes its result — payload or failure envelope — to " +
        "a result file rather than stdout, so its reader takes a path, not bytes.",
    },
  },
];

const CODE = 0;
const COMMENT = 1;
const STRING = 2;

/**
 * Classify every character of Go source as code, comment, or string content.
 *
 * Structural scanning (finding `func` declarations, matching braces) must not
 * see a brace inside a string or a `func` inside a comment, and comment removal
 * must not eat a `//` that is part of a string literal. One pass answers both.
 */
function classify(source) {
  const kinds = new Uint8Array(source.length);
  let index = 0;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (char === "/" && next === "/") {
      while (index < source.length && source[index] !== "\n")
        kinds[index++] = COMMENT;
      continue;
    }
    if (char === "/" && next === "*") {
      kinds[index++] = COMMENT;
      kinds[index++] = COMMENT;
      while (index < source.length) {
        const done = source[index] === "*" && source[index + 1] === "/";
        kinds[index++] = COMMENT;
        if (done) {
          kinds[index++] = COMMENT;
          break;
        }
      }
      continue;
    }
    if (char === "`") {
      index += 1;
      while (index < source.length && source[index] !== "`")
        kinds[index++] = STRING;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'") {
      const quote = char;
      index += 1;
      while (index < source.length && source[index] !== quote) {
        if (source[index] === "\\") {
          kinds[index++] = STRING;
          if (index < source.length) kinds[index++] = STRING;
          continue;
        }
        if (source[index] === "\n") break;
        kinds[index++] = STRING;
      }
      index += 1;
      continue;
    }
    index += 1;
  }
  return kinds;
}

/**
 * A view of `source` in which comments and string contents are blanked out,
 * newlines preserved, so regular expressions and brace matching see structure
 * only.
 */
function structuralView(source, kinds) {
  const out = new Array(source.length);
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    out[index] = kinds[index] === CODE || char === "\n" ? char : " ";
  }
  return out.join("");
}

/** The three copies' Go sources, keyed by copy id. */
function readSources() {
  const sources = {};
  for (const id of COPY_IDS)
    sources[id] = fs
      .readFileSync(path.join(root, COPIES[id].file), "utf8")
      .replace(/\r\n/g, "\n");
  return sources;
}

/** Slice one copy's marked region out of its source. */
function readRegion(id, text) {
  const copy = COPIES[id];
  const source = text.replace(/\r\n/g, "\n");
  const begin = source.indexOf(BEGIN_MARKER);
  const end = source.indexOf(END_MARKER);
  if (begin === -1)
    throw new Error(`${copy.file} has no "${BEGIN_MARKER}" marker`);
  if (end === -1) throw new Error(`${copy.file} has no "${END_MARKER}" marker`);
  if (end < begin)
    throw new Error(`${copy.file} closes the shared region before it opens it`);
  if (source.indexOf(BEGIN_MARKER, begin + 1) !== -1)
    throw new Error(`${copy.file} opens the shared region twice`);
  if (source.indexOf(END_MARKER, end + 1) !== -1)
    throw new Error(`${copy.file} closes the shared region twice`);
  return { id, copy, source, begin, end };
}

/**
 * Every top-level function declared inside the region, by identifier.
 *
 * A declaration is recognized at column 0 only, which is where `gofmt` puts
 * every top-level `func`; methods carry a receiver and are not shared, so the
 * pattern excludes them.
 */
function regionFunctions(region) {
  const kinds = classify(region.source);
  const structural = structuralView(region.source, kinds);
  const pattern = /^func ([A-Za-z_][A-Za-z0-9_]*)\(/gm;
  const found = new Map();
  let match;
  while ((match = pattern.exec(structural)) !== null) {
    const start = match.index;
    if (start < region.begin || start > region.end) continue;
    const stop = closingBrace(structural, start, region.copy.file, match[1]);
    found.set(match[1], {
      identifier: match[1],
      text: region.source.slice(start, stop),
      kinds: kinds.slice(start, stop),
    });
  }
  return found;
}

/** The index just past the `}` that closes the body starting at `start`. */
function closingBrace(structural, start, file, identifier) {
  let depth = 0;
  let opened = false;
  for (let index = start; index < structural.length; index += 1) {
    const char = structural[index];
    if (char === "{") {
      depth += 1;
      opened = true;
      continue;
    }
    if (char !== "}") continue;
    depth -= 1;
    if (opened && depth === 0) return index + 1;
  }
  throw new Error(`${file}: ${identifier} has no closing brace`);
}

/**
 * The comparable form of one function: code only, canonical identifiers,
 * canonical package prefix, collapsed whitespace.
 */
function normalize(fn, copyId, symbolToCanonical) {
  let text = "";
  for (let index = 0; index < fn.text.length; index += 1)
    text += fn.kinds[index] === COMMENT ? " " : fn.text[index];
  for (const [symbol, canonical] of symbolToCanonical)
    text = text.replace(new RegExp(`\\b${symbol}\\b`, "g"), canonical);
  text = text.split(COPIES[copyId].package).join(CANONICAL_PACKAGE);
  return text.replace(/\s+/g, " ").trim();
}

/** The per-copy identifier → canonical name map declared by `SHARED`. */
function symbolMap(copyId) {
  const map = new Map();
  for (const entry of SHARED) {
    const symbol = entry.symbols[copyId];
    if (symbol !== undefined) map.set(symbol, entry.name);
  }
  return map;
}

/**
 * Every way the three copies can disagree, as reader-facing lines.
 *
 * An empty array is the passing state. Every failure names the copies, so a
 * drift report is actionable without reopening the files.
 */
function driftFailures(sources = readSources()) {
  const failures = [];

  for (const entry of SHARED) {
    const declared = Object.keys(entry.symbols ?? {});
    const excused = Object.keys(entry.absent ?? {});
    for (const id of declared)
      if (excused.includes(id))
        failures.push(
          `${entry.name} is declared for ${id} and excused from it at the same time`,
        );
    for (const id of COPY_IDS)
      if (!declared.includes(id) && !excused.includes(id))
        failures.push(
          `${entry.name} says nothing about the ${id} copy; declare its symbol or ` +
            `record why ${id} carries no such function`,
        );
    for (const id of excused)
      if (!String(entry.absent[id] ?? "").trim())
        failures.push(`${entry.name} excuses ${id} without a reason`);
    if (declared.length < 2)
      failures.push(
        `${entry.name} is declared for fewer than two copies, so it is not shared code`,
      );
  }

  const functions = new Map();
  for (const id of COPY_IDS)
    functions.set(id, regionFunctions(readRegion(id, sources[id])));

  // Every function inside a region must be claimed. This is the half that
  // catches a helper added to one copy alone: it is undeclared, so it fails
  // before anyone has to notice the other two copies never got it.
  for (const id of COPY_IDS) {
    const claimed = symbolMap(id);
    for (const identifier of functions.get(id).keys())
      if (!claimed.has(identifier))
        failures.push(
          `${COPIES[id].file}: ${identifier} sits inside the shared region but is not ` +
            `declared in SHARED; add it to the other copies and to the table, or move it ` +
            `outside the markers`,
        );
  }

  for (const entry of SHARED) {
    const bodies = new Map();
    for (const [id, symbol] of Object.entries(entry.symbols ?? {})) {
      const fn = functions.get(id).get(symbol);
      if (fn === undefined) {
        failures.push(
          `${COPIES[id].file}: ${symbol} is declared as the ${id} copy of ${entry.name} ` +
            `but no such function is inside the shared region`,
        );
        continue;
      }
      bodies.set(id, normalize(fn, id, symbolMap(id)));
    }
    const ids = [...bodies.keys()];
    if (ids.length < 2) continue;
    const reference = ids[0];
    const drifted = ids.filter(
      (id) => bodies.get(id) !== bodies.get(reference),
    );
    if (drifted.length === 0) continue;
    failures.push(
      `${entry.name} has drifted: ${COPIES[reference].file} disagrees with ` +
        drifted.map((id) => COPIES[id].file).join(", ") +
        `. One policy lives in ${ids.length} copies; change them together or the ` +
        `next fix will be filed against whichever copy was missed.`,
    );
  }

  return failures;
}

module.exports = {
  BEGIN_MARKER,
  CANONICAL_PACKAGE,
  COPIES,
  COPY_IDS,
  END_MARKER,
  SHARED,
  driftFailures,
  normalize,
  readRegion,
  readSources,
  regionFunctions,
  symbolMap,
};

if (require.main === module) {
  const failures = driftFailures();
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.stdout.write(
    failures.length === 0
      ? `config loader copies agree (${SHARED.length} shared functions across ${COPY_IDS.length} copies)\n`
      : `${failures.length} config loader copy failures\n`,
  );
  process.exit(failures.length === 0 ? 0 : 1);
}
