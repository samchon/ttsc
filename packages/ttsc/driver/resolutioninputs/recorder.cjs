"use strict";
/**
 * The inputs one module resolution reads, recorded where a JavaScript program
 * is evaluated to produce something ttsc caches: a plugin descriptor, a
 * utility plugin's config file (samchon/ttsc#1501).
 *
 * The evaluator runs in a process of its own, so it reports what it read as a
 * set of inputs, each with the hash of its content (`null` when absent), its
 * physical path, and the proof that it held still while it was read. An input
 * that did not hold still is reported without a hash, and a cache then proves
 * nothing by it. Every evaluator that records resolution inputs takes the rule
 * from this one file: ttsc reads it in, and a Go plugin embeds it
 * (`resolutioninputs.Recorder`).
 *
 * A resolution's candidates are fingerprinted before the resolver runs, so a
 * higher-priority candidate that appears while the program evaluates cannot
 * bless the earlier result, and committed once it settles. A bare specifier's
 * search stops at the first search root whose package it selects
 * (`moduleResolutionBaseSelects`): the roots after it were never read, so
 * their candidates are not inputs. A missing candidate is proven absent by
 * the metadata of its nearest existing ancestor, and for a root past the
 * selected one that ancestor can be a directory as busy as a home directory,
 * which would withdraw the proof for a path that cannot have steered the
 * resolution. A resolution that fails read every root, and commits them all.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { fileURLToPath } = require("node:url");

/** The state a directory input is recorded with, whatever it holds. */
const DIRECTORY_STATE = crypto
  .createHash("sha256")
  .update("ttsc:host-input:directory\0")
  .digest("hex");

/** The TypeScript sources a JavaScript specifier can be served from. */
const TYPESCRIPT_SUBSTITUTIONS = new Map([
  [".js", [".ts", ".tsx"]],
  [".jsx", [".tsx"]],
  [".mjs", [".mts"]],
  [".cjs", [".cts"]],
]);

/** Whether `file` is a regular file, following links. */
function existingFile(file) {
  try {
    return fs.statSync(file).isFile();
  } catch {
    return false;
  }
}

function missingPathError(error) {
  return !!error && (error.code === "ENOENT" || error.code === "ENOTDIR");
}

/**
 * The metadata identity of a path, which exposes a content-preserving A-B-A
 * replacement: the path's own, and its link target's. A missing path is tied
 * to its nearest existing ancestor, whose metadata moves when the missing
 * branch appears or disappears. `undefined` when it cannot be taken.
 */
function metadataSignature(file) {
  const requested = path.resolve(file);
  let current = requested;
  for (;;) {
    try {
      const link = fs.lstatSync(current, { bigint: true });
      let target = link;
      if (link.isSymbolicLink()) {
        try {
          target = fs.statSync(current, { bigint: true });
        } catch {
          return undefined;
        }
      }
      return [
        path.relative(current, requested),
        link.dev,
        link.ino,
        link.mode,
        link.size,
        link.mtimeNs,
        link.ctimeNs,
        target.dev,
        target.ino,
        target.mode,
        target.size,
        target.mtimeNs,
        target.ctimeNs,
      ].join(":");
    } catch (error) {
      if (!missingPathError(error)) return undefined;
      const parent = path.dirname(current);
      if (parent === current) return undefined;
      current = parent;
    }
  }
}

/** An absolute path or file URL as a path, or `undefined`. */
function asFile(value) {
  if (typeof value !== "string") return undefined;
  if (!value.startsWith("file:")) {
    return path.isAbsolute(value) ? path.resolve(value) : undefined;
  }
  try {
    return path.resolve(fileURLToPath(value));
  } catch {
    return undefined;
  }
}

/** The physical spelling of an absolute path or file URL, or `undefined`. */
function selectedFile(value) {
  const file = asFile(value);
  if (file === undefined) return undefined;
  try {
    return fs.realpathSync.native(file);
  } catch {
    return file;
  }
}

/** Every file a resolution probes for one base, in probe order. */
function moduleCandidates(base, extensions) {
  const extension = path.extname(base).toLowerCase();
  const stem = base.slice(0, base.length - extension.length);
  return [
    base,
    ...(TYPESCRIPT_SUBSTITUTIONS.get(extension) ?? []).map(
      (candidate) => stem + candidate,
    ),
    ...extensions.map((candidate) => base + candidate),
    path.join(base, "package.json"),
    ...extensions.map((candidate) => path.join(base, "index" + candidate)),
  ];
}

/**
 * Whether a module-resolution base is the one a completed resolution selected:
 * the resolved file is the base itself, one of its probed spellings, or lies
 * inside the base as a directory, compared by physical spelling.
 *
 * @param {string} base A package directory, or a path a specifier names.
 * @param {string | undefined} resolvedFile The selected file, a path or a file
 *   URL, or `undefined` for a resolution that failed.
 * @param {readonly string[]} extensions The extensions the resolution probes.
 */
function moduleResolutionBaseSelects(base, resolvedFile, extensions) {
  const selected = selectedFile(resolvedFile);
  if (selected === undefined) return false;
  for (const candidate of moduleCandidates(path.resolve(base), extensions)) {
    try {
      const canonical = fs.realpathSync.native(candidate);
      const relative = path.relative(canonical, selected);
      if (
        relative === "" ||
        (fs.statSync(canonical).isDirectory() &&
          relative !== ".." &&
          !relative.startsWith(".." + path.sep) &&
          !path.isAbsolute(relative))
      ) {
        return true;
      }
    } catch {
      // A missing candidate selects nothing.
    }
  }
  return false;
}

/** The bases a relative, absolute, or file URL specifier names. */
function localBases(specifier, parentFile) {
  if (specifier.startsWith("file:")) return [fileURLToPath(specifier)];
  const directory = path.dirname(parentFile);
  const raw = path.resolve(directory, specifier);
  const suffixStart = specifier.search(/[?#]/);
  if (suffixStart === -1) return [raw];
  const pathname = specifier.slice(0, suffixStart);
  return pathname === ""
    ? [raw]
    : [...new Set([raw, path.resolve(directory, pathname)])];
}

/** Every `package.json` from `file`'s directory up to the first that exists. */
function visitPackageManifests(file, visit) {
  for (let directory = path.dirname(path.resolve(file)); ; ) {
    const manifest = path.join(directory, "package.json");
    visit(manifest);
    if (existingFile(manifest)) return;
    const parent = path.dirname(directory);
    if (parent === directory) return;
    directory = parent;
  }
}

function visitManifestTargets(
  value,
  directory,
  allowBare,
  extensions,
  visit,
  bases,
) {
  if (typeof value === "string") {
    if (
      value !== "" &&
      (allowBare || value.startsWith("./") || value.startsWith("../"))
    ) {
      visitModuleCandidates(
        path.resolve(directory, value),
        extensions,
        visit,
        bases,
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      visitManifestTargets(item, directory, allowBare, extensions, visit, bases);
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      visitManifestTargets(item, directory, allowBare, extensions, visit, bases);
    }
  }
}

/** The candidates of one base, and of the targets its manifest names. */
function visitModuleCandidates(base, extensions, visit, bases) {
  const resolvedBase = path.resolve(base);
  if (bases.has(resolvedBase)) return;
  bases.add(resolvedBase);
  for (const candidate of moduleCandidates(resolvedBase, extensions)) {
    visit(candidate);
  }
  try {
    const manifest = JSON.parse(
      fs
        .readFileSync(path.join(resolvedBase, "package.json"), "utf8")
        .replace(/^﻿/, ""),
    );
    visitManifestTargets(
      manifest.exports,
      resolvedBase,
      false,
      extensions,
      visit,
      bases,
    );
    visitManifestTargets(
      manifest.module,
      resolvedBase,
      true,
      extensions,
      visit,
      bases,
    );
    visitManifestTargets(
      manifest.main,
      resolvedBase,
      true,
      extensions,
      visit,
      bases,
    );
  } catch {
    // The resolver owns malformed package diagnostics.
  }
}

/**
 * The candidates one resolution can read, in search order. `visit` receives
 * each with the package directory of the search root it belongs to, or
 * `undefined` for a relative or absolute specifier. The search stops at the
 * root whose package `resolved` selects, so without one it covers every root.
 *
 * @param {string} specifier The specifier as the importer wrote it.
 * @param {string} parent The importer, a path or a file URL.
 * @param {string | undefined} resolved The selected file, when known.
 * @param {readonly string[]} extensions The extensions the resolution probes.
 * @param {(file: string, root: string | undefined) => void} visit
 * @param {Set<string>} bases The bases already visited, shared by the calls
 *   whose candidates one caller has recorded.
 */
function visitResolutionCandidates(
  specifier,
  parent,
  resolved,
  extensions,
  visit,
  bases,
) {
  const parentFile = asFile(parent);
  if (typeof specifier !== "string" || parentFile === undefined) return;
  const selected = selectedFile(resolved);
  if (
    specifier.startsWith(".") ||
    path.isAbsolute(specifier) ||
    specifier.startsWith("file:")
  ) {
    const local = (file) => visit(file, undefined);
    try {
      for (const base of localBases(specifier, parentFile)) {
        visitPackageManifests(base, local);
        let exact = false;
        try {
          exact =
            selected === undefined
              ? fs.statSync(base).isFile()
              : fs.realpathSync.native(base) === selected;
        } catch {
          // A missing base is probed through its candidates.
        }
        if (exact) local(base);
        else visitModuleCandidates(base, extensions, local, bases);
      }
    } catch {
      // The resolver owns invalid URL spellings.
    }
    return;
  }
  if (Module.isBuiltin(specifier) || specifier.startsWith("#")) return;
  const parts = specifier.split("/");
  const packageParts = parts[0].startsWith("@")
    ? parts.slice(0, 2)
    : parts.slice(0, 1);
  if (packageParts.some((part) => part === undefined || part === "")) return;
  const packageName = packageParts.join("/");
  const subpath = parts.slice(packageParts.length);
  for (const searchPath of Module.createRequire(parentFile).resolve.paths(
    specifier,
  ) ?? []) {
    const packageDirectory = path.join(searchPath, packageName);
    const rooted = (file) => visit(file, packageDirectory);
    visitModuleCandidates(packageDirectory, extensions, rooted, bases);
    if (subpath.length !== 0) {
      visitModuleCandidates(
        path.join(packageDirectory, ...subpath),
        extensions,
        rooted,
        bases,
      );
    }
    if (moduleResolutionBaseSelects(packageDirectory, selected, extensions)) {
      break;
    }
  }
}

/**
 * Record the inputs of one evaluation.
 *
 * The caller installs its own resolution hooks and brackets every resolution
 * with `beginResolution` and `endResolution`; `recordFile` records a module
 * the evaluation loaded outside a resolution, such as its entry; `finish`
 * re-reads every input once the evaluation ended and returns the record.
 *
 * @param {{ extensions: readonly string[] }} options The extensions the
 *   host's resolution probes.
 */
function createResolutionInputRecorder(options) {
  const extensions = options.extensions;
  const inputs = new Set();
  const hashes = new Map();
  const realpaths = new Map();
  const signatures = new Map();
  const unstable = new Set();
  const recordedBases = new Set();

  /** Observe one path now; `commitOne` decides later whether it is an input. */
  const observe = (file) => {
    file = path.resolve(file);
    const before = metadataSignature(file);
    let realpath;
    try {
      realpath = fs.realpathSync.native(file);
    } catch {
      realpath = null;
    }
    let hash;
    try {
      hash = fs.statSync(file).isDirectory()
        ? DIRECTORY_STATE
        : crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
    } catch {
      hash = null;
    }
    return { after: metadataSignature(file), before, file, hash, realpath };
  };

  /** Merge one observation; any disagreement leaves the input unproven. */
  const commitOne = (observation) => {
    const { after, before, file, hash, realpath } = observation;
    inputs.add(file);
    if (unstable.has(file)) return;
    if (
      before === undefined ||
      after === undefined ||
      before !== after ||
      (signatures.has(file) && signatures.get(file) !== after) ||
      (realpaths.has(file) && realpaths.get(file) !== realpath) ||
      (hashes.has(file) && hashes.get(file) !== hash)
    ) {
      hashes.delete(file);
      realpaths.delete(file);
      signatures.delete(file);
      unstable.add(file);
      return;
    }
    signatures.set(file, after);
    realpaths.set(file, realpath);
    hashes.set(file, hash);
  };

  /**
   * Merge one observation and observe every symbolic link among its lexical
   * ancestors, so retargeting one is a change.
   */
  const commit = (observation) => {
    commitOne(observation);
    const parsed = path.parse(observation.file);
    let current = parsed.root;
    const relative = path.relative(parsed.root, observation.file);
    for (const segment of relative.split(path.sep).slice(0, -1)) {
      if (segment === "") continue;
      current = path.join(current, segment);
      try {
        if (!fs.lstatSync(current).isSymbolicLink()) continue;
      } catch {
        break;
      }
      const link = path.resolve(current);
      if (unstable.has(link)) inputs.add(link);
      else commitOne(observe(link));
    }
  };

  const record = (file) => commit(observe(file));

  /** Record a module and every package scope manifest up to the first. */
  const recordFile = (resolved) => {
    const file = asFile(resolved);
    if (file === undefined) return;
    record(file);
    visitPackageManifests(file, record);
  };

  return {
    /**
     * Fingerprint every candidate one resolution can read, before it runs.
     *
     * @param {string} specifier
     * @param {string | undefined} parent The importer, a path or a file URL.
     */
    beginResolution(specifier, parent) {
      const pending = [];
      const roots = [];
      const seen = new Set();
      visitResolutionCandidates(
        specifier,
        parent,
        undefined,
        extensions,
        (file, root) => {
          // A root is in the search order even when every candidate of it is
          // already an input, or the root that selects a repeated resolution
          // would be missing from it and every root past it committed.
          if (root !== undefined && !roots.includes(root)) roots.push(root);
          file = path.resolve(file);
          if (seen.has(file) || inputs.has(file)) return;
          seen.add(file);
          pending.push({ observation: observe(file), root });
        },
        new Set(),
      );
      return { parent, pending, roots, specifier };
    },
    /**
     * Settle a resolution: commit the fingerprints of the candidates it could
     * have read, record them again as they are now, and record the module it
     * selected.
     *
     * @param {{ parent: string | undefined, pending: { observation: object, root: string | undefined }[], roots: string[], specifier: string }} token
     * @param {string | undefined} resolved The selected module, a path or a
     *   file URL, or `undefined` when the resolution failed.
     */
    endResolution(token, resolved) {
      const roots = token.roots;
      const reached = roots.findIndex((root) =>
        moduleResolutionBaseSelects(root, resolved, extensions),
      );
      const read = new Set(reached === -1 ? roots : roots.slice(0, reached + 1));
      for (const { observation, root } of token.pending) {
        if (root === undefined || read.has(root)) commit(observation);
      }
      if (resolved === undefined) return;
      visitResolutionCandidates(
        token.specifier,
        token.parent,
        resolved,
        extensions,
        record,
        recordedBases,
      );
      recordFile(resolved);
    },
    recordFile,
    /** Read every input once more and return the record. */
    finish() {
      for (const input of [...inputs]) record(input);
      return {
        hashes: Object.fromEntries(hashes),
        inputs: [...inputs].sort(),
        realpaths: Object.fromEntries(realpaths),
      };
    },
  };
}

module.exports = {
  createResolutionInputRecorder,
  moduleResolutionBaseSelects,
  visitResolutionCandidates,
};
