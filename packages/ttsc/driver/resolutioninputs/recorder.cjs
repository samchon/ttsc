"use strict";
/**
 * The inputs one module resolution reads, recorded where a JavaScript program
 * is evaluated to produce something ttsc caches: a plugin descriptor, a utility
 * plugin's config file.
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
 * (`moduleResolutionBaseSelects`): the roots after it were never read, so their
 * candidates are not inputs. A missing candidate is proven absent by the
 * metadata of its nearest existing ancestor, and for a root past the selected
 * one that ancestor can be a directory as busy as a home directory, which would
 * withdraw the proof for a path that cannot have steered the resolution. A
 * resolution that fails read every root, and commits them all. A `#` specifier
 * its package's `imports` maps to a bare package reads that package's roots the
 * same way. Every declared target is observed before resolution; the actual
 * selection narrows which prior package observations are committed, without
 * refreshing them to the later state (`visitImportMappedCandidates`). Search
 * root witnesses additionally protect candidates discovered only afterwards.
 * A failed `#` resolution retains every declared target's observations.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const { fileURLToPath, pathToFileURL } = require("node:url");

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
 * replacement: the path's own, and its link target's. A missing path is tied to
 * its nearest existing ancestor, whose metadata moves when the missing branch
 * appears or disappears. `undefined` when it cannot be taken.
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

/** Realpath or normalized lexical fallback for an absolute path/file URL. */
function selectedFile(value) {
  const file = asFile(value);
  if (file === undefined) return undefined;
  try {
    return fs.realpathSync.native(file);
  } catch {
    return file;
  }
}

/**
 * Reject case-folded lexical containment unless actual filesystem identity
 * agrees.
 */
function physicallyRelative(base, selected) {
  const relative = path.relative(base, selected);
  if (
    relative === ".." ||
    relative.startsWith(".." + path.sep) ||
    path.isAbsolute(relative)
  )
    return undefined;
  if (path.resolve(base, relative) === selected) return relative;
  let ancestor = selected;
  for (const segment of relative.split(path.sep)) {
    if (segment !== "") ancestor = path.dirname(ancestor);
  }
  try {
    const left = fs.statSync(base, { bigint: true });
    const right = fs.statSync(ancestor, { bigint: true });
    return left.ino !== 0n && left.dev === right.dev && left.ino === right.ino
      ? relative
      : undefined;
  } catch {
    return undefined;
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
 * inside the base as a directory. Candidates require realpath; a selected file
 * whose realpath fails retains normalized lexical spelling, so this is not a
 * certificate that every selected object was physically resolved.
 *
 * @param {string} base A package directory, or a path a specifier names.
 * @param {string | undefined} resolvedFile The selected file, a path or a file
 *   URL, or `undefined` for a resolution that failed.
 * @param {readonly string[]} extensions The extensions the resolution probes.
 *
 * @evidence contracts/common.md#principled-implementation Selection uses candidate realpaths and actual root identity when native relative paths fold spelling; case-sensitive siblings cannot count as the selected root.
 * @evidence contracts/common.md#clear-and-simple-design The predicate owns candidate membership and delegates only file normalization and physical containment.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Native filesystem identity supplies the case exception; no platform-name assumption or expected package answer is substituted.
 * @evidence contracts/common.md#meaningful-documentation JSDoc distinguishes candidate realpaths, selected lexical fallback and failed-resolution absence, with separate parameter prose and tags.
 * @evidence contracts/portability.md#os-neutral-implementation Node native path and realpath APIs handle separators; ambiguous folded containment requires nonzero device/inode identity rather than assuming Windows is insensitive.
 * @evidence contracts/performance.md#efficient-algorithms The complete candidate array is constructed before scanning until selection. Path/extension text, native selected and candidate realpaths, relative containment, optional ancestor identity stats and candidate directory stats contribute work; fixed loop steps do not bound filesystem resolution cost.
 * @evidence contracts/performance.md#reuse-equivalent-work Each candidate canonicalization is reused for equality and containment within the call; mutable filesystem selection is not cached across evaluations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Candidate arrays and synchronous stat values are call-local and no descriptor remains retained.
 */
function moduleResolutionBaseSelects(base, resolvedFile, extensions) {
  const selected = selectedFile(resolvedFile);
  if (selected === undefined) return false;
  for (const candidate of moduleCandidates(path.resolve(base), extensions)) {
    try {
      const canonical = fs.realpathSync.native(candidate);
      const relative = physicallyRelative(canonical, selected);
      if (
        relative !== undefined &&
        (relative === "" ||
          (fs.statSync(canonical).isDirectory() &&
            relative !== ".." &&
            !relative.startsWith(".." + path.sep) &&
            !path.isAbsolute(relative)))
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
      visitManifestTargets(
        item,
        directory,
        allowBare,
        extensions,
        visit,
        bases,
      );
    }
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      visitManifestTargets(
        item,
        directory,
        allowBare,
        extensions,
        visit,
        bases,
      );
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
 * first root accepted by the selected-file/candidate identity comparison;
 * unavailable realpaths can leave a lexical selected-file fallback. Without a
 * selected root it visits all supplied search roots. Local expansion and
 * manifest expansion catch failures, including visitor failures inside those
 * guarded operations; this is not a transcript of every native resolver read.
 *
 * @param {string} specifier The specifier as the importer wrote it.
 * @param {string} parent The importer, a path or a file URL.
 * @param {string | undefined} resolved The selected file, when known.
 * @param {readonly string[]} extensions The extensions the resolution probes.
 * @param {(file: string, root: string | undefined) => void} visit
 * @param {Set<string>} bases The bases already visited, shared by the calls
 *   whose candidates one caller has recorded.
 *
 * @evidence contracts/common.md#principled-implementation Candidate observations use the importer's supplied native search roots and stop at the first accepted selected-file comparison; absent selection retains candidate expansion for all those roots, not proof of every resolver read.
 * @evidence contracts/common.md#clear-and-simple-design Local and package specifiers share candidate expansion while the visitor owns observation storage.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Public createRequire search paths supply package roots; no private resolver mutation or fixture-specific selection is used.
 * @evidence contracts/common.md#meaningful-documentation Parameters explain optional roots, failed selection, and shared deduplication ownership with a blank line before acknowledgments.
 * @evidence contracts/portability.md#os-neutral-implementation Native path operations and file-URL conversion preserve importer representation without inferring case policy from the OS.
 * @evidence contracts/performance.md#efficient-algorithms Costs include native search/realpath/stat operations, eager extension candidate arrays, ancestor manifests and their bytes, recursive target expansion, path text and supplied visitor work; accepted selection truncates later roots, with no fixed payload or recursion bound.
 * @evidence contracts/performance.md#reuse-equivalent-work The caller-owned bases set shares candidate expansion across resolutions in one evaluation; a new evaluation receives fresh mutable-file observations.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The caller owns the shared deduplication set and visitor retention; call-local candidate arrays, parsed manifests and recursive expansion are uncapped, while synchronous reads retain no open file handle after return.
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

/** The `node_modules` directories a bare lookup from `parentFile` searches. */
function searchRoots(parentFile) {
  return Module.createRequire(parentFile).resolve.paths("x") ?? [];
}

/**
 * Fingerprint the search roots a `#` import of `parent` can resolve a bare
 * package through, before the resolution runs. Which package that is can be
 * named precisely only once the resolution selected it. Declared targets have
 * their own earlier candidate observations; these additional root witnesses
 * protect selected candidates discovered only after resolution.
 *
 * @param {string | undefined} parent The importer, a path or a file URL.
 *
 * @returns {Map<string, string | undefined> | undefined}
 *
 * @evidence contracts/common.md#principled-implementation Taking native root metadata before mapped resolution witnesses changes that a later candidate read alone cannot establish.
 * @evidence contracts/common.md#clear-and-simple-design The function returns only root witnesses; selected-package discovery and committing candidates belong to the later phase.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Actual importer search paths and metadata provide evidence; missing or inaccessible metadata remains undefined rather than manufactured stable state.
 * @evidence contracts/common.md#meaningful-documentation Native documentation explains the pre-resolution timing and why the selected package is not yet known; paragraph and tag spacing follow documentation guidance.
 * @evidence contracts/portability.md#os-neutral-implementation File URLs become native absolute paths and public createRequire obtains platform search paths; bigint stat witnesses retain actual native identity.
 * @evidence contracts/performance.md#efficient-algorithms Native importer/file-URL normalization and public require search-root discovery precede one metadataSignature per root. Missing paths can walk ancestors and symbolic entries add target stats; work and temporary signatures include root/path/metadata text and delegated native operations, with no root-list cap here.
 * @evidence contracts/performance.md#reuse-equivalent-work The returned map is reused by the corresponding completion phase only; another resolution observes a new window.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The returned map transfers to the caller's resolution token; reclamation requires that owner to release it. Native synchronous metadata calls leave no retained descriptor or watcher, and this operation keeps no historical root map.
 */
function observeImportSearchRoots(parent) {
  const parentFile = asFile(parent);
  if (parentFile === undefined) return undefined;
  return new Map(
    searchRoots(parentFile).map((root) => [root, metadataSignature(root)]),
  );
}

/** The package name a path below a `node_modules` directory begins with. */
function packageNameBelow(relative) {
  const parts = relative.split(path.sep);
  const name = parts.slice(0, parts[0].startsWith("@") ? 2 : 1);
  return name.every(
    (part) =>
      part !== undefined && part !== "" && part !== "." && part !== "..",
  ) && parts.length > name.length
    ? name.join("/")
    : undefined;
}

/**
 * Whether `selected` belongs to the importer's own package: below the directory
 * of its nearest manifest, and below no `node_modules` there. An `imports`
 * target of that kind is a path, not a package lookup.
 */
function withinImporterPackage(parentFile, selected) {
  for (let directory = path.dirname(parentFile); ; ) {
    if (existingFile(path.join(directory, "package.json"))) {
      let owner;
      try {
        owner = fs.realpathSync.native(directory);
      } catch {
        owner = directory;
      }
      const relative = physicallyRelative(owner, selected);
      return (
        relative !== undefined &&
        relative !== ".." &&
        !relative.startsWith(".." + path.sep) &&
        !path.isAbsolute(relative) &&
        !relative.split(path.sep).includes("node_modules")
      );
    }
    const parent = path.dirname(directory);
    if (parent === directory) return false;
    directory = parent;
  }
}

/**
 * The names `selected` can have been looked up by: the directory after the last
 * `node_modules` of its lexical and of its physical spelling, which covers an
 * installed, an aliased, and a linked-store package.
 */
function namesFromPath(files) {
  const names = [];
  for (const file of files) {
    const parts = file.split(path.sep);
    const index = parts.lastIndexOf("node_modules");
    if (index === -1) continue;
    const name = packageNameBelow(parts.slice(index + 1).join(path.sep));
    if (name !== undefined && !names.includes(name)) names.push(name);
  }
  return names;
}

/**
 * The name under which one search root links to a package directory holding
 * `selected`, such as a workspace package, whose physical path carries no
 * `node_modules`.
 */
function linkedNameIn(root, selected, extensions) {
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return undefined;
  }
  for (const entry of entries) {
    if (entry.name.startsWith("@") && entry.isDirectory()) {
      let scoped;
      try {
        scoped = fs.readdirSync(path.join(root, entry.name), {
          withFileTypes: true,
        });
      } catch {
        continue;
      }
      for (const inner of scoped) {
        const name = `${entry.name}/${inner.name}`;
        if (
          inner.isSymbolicLink() &&
          linkSelects(root, name, selected, extensions)
        )
          return name;
      }
      continue;
    }
    if (
      entry.isSymbolicLink() &&
      linkSelects(root, entry.name, selected, extensions)
    )
      return entry.name;
  }
  return undefined;
}

function linkSelects(root, name, selected, extensions) {
  const directory = path.join(root, name);
  let target;
  try {
    target = fs.realpathSync.native(directory);
  } catch {
    return false;
  }
  const relative = physicallyRelative(target, selected);
  return (
    relative !== undefined &&
    relative !== "" &&
    relative !== ".." &&
    !relative.startsWith(".." + path.sep) &&
    !path.isAbsolute(relative) &&
    moduleResolutionBaseSelects(directory, selected, extensions)
  );
}

/**
 * The package directories a `#` import of `parent` that resolved to `resolved`
 * looked its target package up in, in search order up to the one that selected
 * it, each with its search root. Empty for a target inside the importer's own
 * package or one no search root selects.
 */
function importMappedPackageDirectories(parent, resolved, extensions) {
  const parentFile = asFile(parent);
  const lexical = asFile(resolved);
  const selected = selectedFile(resolved);
  if (
    parentFile === undefined ||
    lexical === undefined ||
    selected === undefined
  )
    return [];
  if (withinImporterPackage(parentFile, selected)) return [];
  const roots = searchRoots(parentFile);
  const names = namesFromPath([lexical, selected]);
  const through = (index, name) =>
    roots
      .slice(0, index + 1)
      .map((root) => ({ directory: path.join(root, name), root }));
  for (let index = 0; index < roots.length; index += 1) {
    for (const name of names) {
      if (
        moduleResolutionBaseSelects(
          path.join(roots[index], name),
          selected,
          extensions,
        )
      )
        return through(index, name);
    }
  }
  for (let index = 0; index < roots.length; index += 1) {
    const name = linkedNameIn(roots[index], selected, extensions);
    if (name !== undefined) return through(index, name);
  }
  return [];
}

/**
 * Visit the candidates of the package a `#` import resolved into, in every
 * search root from the importer up to the one that selected it.
 * A package's `imports` may map a `#` specifier to a bare
 * package, which Node looks up through the ordinary `node_modules` search from
 * the importer; a nearer copy would be selected instead. The package is named
 * by the resolved module itself, so Node's `imports` algorithm is not copied.
 *
 * @param {string | undefined} parent The importer, a path or a file URL.
 * @param {string | undefined} resolved The selected module, or `undefined`.
 * @param {readonly string[]} extensions The extensions the resolution probes.
 * @param {Map<string, string | undefined> | undefined} witnesses What
 *   `observeImportSearchRoots` took before the resolution.
 * @param {(file: string, moved: boolean, directory: string) => void} visit Receives each
 *   candidate, and whether the supplied root witness is missing or differs from
 *   its current signature. Omitted witnesses disable this comparison; two
 *   unavailable signatures compare equal and do not prove unchanged identity.
 *
 * @evidence contracts/common.md#principled-implementation Selected path/name candidates and native containment discover mapped package directories; supplied prior root signatures are compared before candidate callbacks. The moved flag reports that comparison, not atomic root stability or completeness when observations are unavailable.
 * @evidence contracts/common.md#clear-and-simple-design Root discovery is separate from visiting candidates and the caller decides how an observed movement affects proof storage.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts The actual selected module supplies package identity; this operation neither substitutes an imports resolver nor repairs missing witnesses with current state.
 * @evidence contracts/common.md#meaningful-documentation JSDoc states phase ordering, failed-result behavior and the moved flag; acknowledgment tags are separate from parameter prose.
 * @evidence contracts/portability.md#os-neutral-implementation Native links, realpaths and actual root identity distinguish workspace aliases from case-sensitive sibling paths without an OS case assumption.
 * @evidence contracts/performance.md#efficient-algorithms Discovery tries names from lexical/selected paths, then scans root/scoped link entries if those names select no root. Importer manifest/ancestor discovery, native path/identity work, complete extension-candidate arrays, recursive manifest target reads/expansion and caller callbacks add costs beyond selected-or-nearer root visitation. Bases deduplicate expansion but do not cap payload, recursion or filesystem work.
 * @evidence contracts/performance.md#reuse-equivalent-work One local bases set shares duplicate expansions and supplied witnesses reuse the earlier root observation rather than substituting a later read.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Root maps are borrowed, deduplication is local and synchronous directory reads leave no retained watcher or descriptor.
 */
function visitImportMappedCandidates(
  parent,
  resolved,
  extensions,
  witnesses,
  visit,
) {
  const bases = new Set();
  for (const { directory, root } of importMappedPackageDirectories(
    parent,
    resolved,
    extensions,
  )) {
    const moved =
      witnesses !== undefined &&
      (!witnesses.has(root) || witnesses.get(root) !== metadataSignature(root));
    visitModuleCandidates(
      directory,
      extensions,
      (file) => visit(file, moved, directory),
      bases,
    );
  }
}

/**
 * Visit the candidates every target of the importer's `imports` entry for a `#`
 * specifier can name, before the resolution runs.
 *
 * A resolution that fails names no module, so nothing afterwards shows which
 * target it tried, yet a program may catch the failure and produce a value that
 * changes once that target appears. Every string target of the matching entry
 * is taken, under every condition, as `exports` targets are
 * (`visitManifestTargets`): an over-approximation costs a spurious
 * invalidation, an omission a stale result. A relative target is a path in the
 * importer's package; a bare one is looked up through every search root.
 *
 * @param {string} specifier The `#` specifier as the importer wrote it.
 * @param {string | undefined} parent The importer, a path or a file URL.
 * @param {readonly string[]} extensions The extensions the resolution probes.
 * @param {(file: string, root: string | undefined) => void} visit Receives each
 *   candidate and its package search directory, or undefined for a local target.
 */
function visitImportTargetCandidates(specifier, parent, extensions, visit) {
  const parentFile = asFile(parent);
  if (parentFile === undefined) return;
  let manifestPath;
  visitPackageManifests(parentFile, (manifest) => {
    manifestPath = manifest;
  });
  if (manifestPath === undefined || !existingFile(manifestPath)) return;
  let imports;
  try {
    imports = JSON.parse(
      fs.readFileSync(manifestPath, "utf8").replace(/^﻿/, ""),
    ).imports;
  } catch {
    return;
  }
  if (!imports || typeof imports !== "object" || Array.isArray(imports)) return;
  const directory = path.dirname(manifestPath);
  const bases = new Set();
  const visitTarget = (value, capture) => {
    if (typeof value === "string") {
      const target =
        capture === undefined ? value : value.split("*").join(capture);
      if (target.startsWith("./") || target.startsWith("../")) {
        visitModuleCandidates(
          path.resolve(directory, target),
          extensions,
          visit,
          bases,
        );
      } else if (target !== "" && !target.startsWith("#")) {
        visitResolutionCandidates(
          target,
          parentFile,
          undefined,
          extensions,
          visit,
          bases,
        );
      }
    } else if (Array.isArray(value)) {
      for (const item of value) visitTarget(item, capture);
    } else if (value && typeof value === "object") {
      for (const item of Object.values(value)) visitTarget(item, capture);
    }
  };
  for (const [key, value] of Object.entries(imports)) {
    if (key === specifier) {
      visitTarget(value, undefined);
      continue;
    }
    const star = key.indexOf("*");
    if (star === -1 || key.indexOf("*", star + 1) !== -1) continue;
    const prefix = key.slice(0, star);
    const suffix = key.slice(star + 1);
    if (
      specifier.length >= key.length &&
      specifier.startsWith(prefix) &&
      specifier.endsWith(suffix)
    ) {
      visitTarget(
        value,
        specifier.slice(prefix.length, specifier.length - suffix.length),
      );
    }
  }
}

/**
 * Record the inputs of one evaluation.
 *
 * The caller installs its own resolution hooks and brackets every resolution
 * with `beginResolution` and `endResolution`; `recordFile` records a module the
 * evaluation loaded outside a resolution, such as its entry; `finish` re-reads
 * every input once the evaluation ended and returns the record.
 *
 * @param {{ extensions: readonly string[] }} options The extensions the host's
 *   resolution probes.
 *
 *   The caller must observe every resolution through supported hooks, and call
 *   `invalidateObservation` when its observation capability is incomplete.
 *   Completeness is separate from per-input stability: a moved input remains in
 *   the input set without a hash, even when resolution observation is
 *   complete.
 *
 * @evidence contracts/common.md#principled-implementation Before/after metadata plus repeated content and physical observations withdraw contradictory per-input proofs; the separate complete flag reports known observation capability gaps.
 * @evidence contracts/common.md#clear-and-simple-design One evaluation owns its input ledger, resolution tokens and final envelope; callers explicitly invalidate capability rather than manipulating proof maps.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Unknown observations retain missing proofs and incomplete capability remains false; no expected digest or resolver monkeypatch makes reuse appear valid.
 * @evidence contracts/common.md#meaningful-documentation JSDoc describes hook ownership, entry recording, final reread and capability versus stability; returned operations have native descriptions and tags are separated.
 * @evidence contracts/portability.md#os-neutral-implementation Native stat/realpath and URL conversion represent paths and identities; symlink ancestors are observed without equating an OS name to filesystem case policy.
 * @evidence contracts/performance.md#efficient-algorithms Sets/maps index paths, but candidate expansion and repeated pre/post/final observations still pay native stat/realpath/ancestor-link work and full file hashing; finish visits its captured input list and sorts output paths, with uncapped byte, path and manifest-expansion costs.
 * @evidence contracts/performance.md#reuse-equivalent-work Distinct candidates share the evaluation ledger and expanded bases; the first witness stays authoritative and contradictory later reads revoke its proof instead of refreshing it.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Returned closures retain uncapped input/proof/unstable/base collections and borrow extensions; caller-owned resolution tokens and result arrays add retention. This constructor neither starts an isolated subprocess nor installs/releases hooks; callers own those lifetimes, and synchronous observations leave no open file handles.
 */
function createResolutionInputRecorder(options) {
  let complete = true;
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
        : crypto
            .createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex");
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
      const seenRoots = new Set();
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
          if (root !== undefined && !seenRoots.has(root)) {
            seenRoots.add(root);
            roots.push(root);
          }
          file = path.resolve(file);
          if (seen.has(file) || inputs.has(file)) return;
          seen.add(file);
          pending.push({ observation: observe(file), root });
        },
        new Set(),
      );
      const isImport =
        typeof specifier === "string" && specifier.startsWith("#");
      // Success narrows these prior observations to the selected package's
      // reached roots. It must not replace them with post-resolution readings.
      const importPending = [];
      if (isImport) {
        visitImportTargetCandidates(specifier, parent, extensions, (file, root) => {
          file = path.resolve(file);
          if (seen.has(file) || inputs.has(file)) return;
          seen.add(file);
          importPending.push({ ...observe(file), root });
        });
      }
      return {
        imports: isImport ? observeImportSearchRoots(parent) : undefined,
        importPending,
        parent,
        pending,
        roots,
        specifier,
      };
    },
    /**
     * Settle a resolution: commit the fingerprints of the candidates it could
     * have read, record them again as they are now, and record the module it
     * selected.
     *
     * @param {{
     *   importPending: object[];
     *   parent: string | undefined;
     *   pending: { observation: object; root: string | undefined }[];
     *   roots: string[];
     *   specifier: string;
     * }} token
     * @param {string | undefined} resolved The selected module, a path or a
     *   file URL, or `undefined` when the resolution failed.
     */
    endResolution(token, resolved) {
      const roots = token.roots;
      const reached = roots.findIndex((root) =>
        moduleResolutionBaseSelects(root, resolved, extensions),
      );
      const read = new Set(
        reached === -1 ? roots : roots.slice(0, reached + 1),
      );
      for (const { observation, root } of token.pending) {
        if (root === undefined || read.has(root)) commit(observation);
      }
      if (resolved === undefined) {
        for (const observation of token.importPending ?? [])
          commit(observation);
        return;
      }
      if (token.imports !== undefined) {
        const pendingByRoot = new Map();
        const pendingByFile = new Map();
        for (const observation of token.importPending ?? []) {
          pendingByFile.set(observation.file, observation);
          if (observation.root === undefined) continue;
          let group = pendingByRoot.get(observation.root);
          if (group === undefined) {
            group = [];
            pendingByRoot.set(observation.root, group);
          }
          group.push(observation);
        }
        visitImportMappedCandidates(
          token.parent,
          resolved,
          extensions,
          token.imports,
          (file, moved, directory) => {
            const prior = pendingByRoot.get(directory);
            if (prior !== undefined) {
              pendingByRoot.delete(directory);
              for (const observation of prior) commit(observation);
            }
            const earlier = pendingByFile.get(path.resolve(file));
            if (earlier !== undefined && earlier.root === undefined)
              commit(earlier);
            const observation = observe(file);
            commit(moved ? { ...observation, before: undefined } : observation);
          },
        );
        // A local target, or a link retargeted after Node selected it, need not
        // have a currently discoverable package root. Its available earlier
        // file witness still belongs to the selected result and cannot be lost.
        const selected = selectedFile(resolved);
        for (const observation of token.importPending ?? [])
          if (selected !== undefined && observation.realpath === selected)
            commit(observation);
      }
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

    /** Withdraw completeness when the evaluator cannot observe an input source. */
    invalidateObservation() {
      complete = false;
    },

    /**
     * Revalidate known inputs; completeness describes resolution capability
     * separately.
     */
    finish() {
      for (const input of [...inputs]) record(input);
      return {
        complete,
        hashes: Object.fromEntries(hashes),
        inputs: [...inputs].sort(),
        realpaths: Object.fromEntries(realpaths),
      };
    },

    /**
     * Copy the metadata witnesses retained with the current content proofs.
     * Call after `finish` to transfer its revalidated identities to an owned
     * runtime reporter without taking a later observation or changing the
     * persisted evaluation envelope. Missing keys remain unavailable proof.
     */
    metadataSignatures() {
      return Object.fromEntries(signatures);
    },
  };
}

/**
 * Install supported resolution observation for one isolated evaluation.
 *
 * A resolve hook registered through `module.registerHooks`, the supported
 * customization API, observes resolutions that reach the installed hook. A
 * runtime that does not expose hooks, or whose `require.resolve` bypasses them,
 * leaves the observation incomplete. Evaluation still proceeds; its consumer
 * must withdraw reuse rather than assume an unobserved resolution consulted no
 * inputs. No private resolver entry point is replaced.
 * The permanent hook handle is not returned or deregistered here; the caller
 * owns the isolated process lifetime, and repeated installation retains
 * additional callbacks and their recorders.
 *
 * @param {ReturnType<typeof createResolutionInputRecorder>} recorder
 *
 * @evidence contracts/common.md#principled-implementation Public synchronous resolve hooks bracket actual resolution; an unsuccessful capability probe or registration withdraws completeness while preserving ordinary evaluation.
 * @evidence contracts/common.md#clear-and-simple-design This adapter installs one resolution callback and leaves storage and capability state with the supplied recorder.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts Only documented module.registerHooks is used; unsupported require.resolve observation is explicit and no foreign resolver or internal method is replaced.
 * @evidence contracts/common.md#meaningful-documentation Native prose explains isolated ownership, unsupported-runtime effects and incomplete reuse; tags follow a blank comment line.
 * @evidence contracts/portability.md#os-neutral-implementation Runtime capability is probed directly, independent of OS or guessed Node version; resolved file URLs are interpreted by the recorder's native boundary.
 * @evidence contracts/performance.md#efficient-algorithms A callback delegates once to Node's resolver but recorder begin/end may expand many roots/manifests and repeat native metadata/content observations; the capability probe performs separate native resolution work, and delegated byte/path/callback costs have no fixed bound.
 * @evidence contracts/performance.md#reuse-equivalent-work All callbacks share the supplied evaluation ledger; probe observations are a capability question, not cached module-resolution answers.
 * @evidence contracts/performance.md#bound-retention-and-release-resources The temporary probe attempts deregistration in finally; successfully installed observation hooks retain the recorder without a returned cleanup handle. Repeated installations are not deduplicated or bounded here, so the caller owns process isolation and eventual hook/ledger lifetime.
 */
function observeResolutions(recorder) {
  if (!requireResolveConsultsHooks()) recorder.invalidateObservation();
  if (typeof Module.registerHooks !== "function") return;
  try {
    Module.registerHooks({
      resolve(specifier, context, nextResolve) {
        const resolution = recorder.beginResolution(
          specifier,
          context.parentURL,
        );
        let resolved;
        try {
          resolved = nextResolve(specifier, context);
        } catch (error) {
          recorder.endResolution(resolution, undefined);
          throw error;
        }
        recorder.endResolution(
          resolution,
          typeof resolved === "string" ? resolved : resolved && resolved.url,
        );
        return resolved;
      },
    });
  } catch {
    recorder.invalidateObservation();
  }
}

/**
 * Whether `require.resolve` consults resolve hooks registered with
 * `module.registerHooks`, asked of the runtime rather than read from its
 * version: a sentinel only a probe hook answers is resolved, and the hook is
 * removed after. Absence or refusal of the public API means incomplete
 * observation, not a configuration evaluation error. The returned flag records
 * that the hook was consulted, not independent successful resolution; cleanup
 * remains the registered hook's supported deregistration operation.
 *
 * @evidence contracts/common.md#principled-implementation A sentinel short-circuited exclusively by a temporary public hook tests whether createRequire.resolve actually invokes that hook on this runtime.
 * @evidence contracts/common.md#clear-and-simple-design A boolean capability result separates installation policy from the probe's registration and cleanup.
 * @evidence contracts/common.md#prohibited-implementation-shortcuts No Node version list or private resolver replacement substitutes for observing the supported hook; inability to register returns false.
 * @evidence contracts/common.md#meaningful-documentation Native documentation identifies the probed API, temporary lifetime and conservative failure meaning with separated acknowledgment tags.
 * @evidence contracts/portability.md#os-neutral-implementation The sentinel uses createRequire anchored by a native absolute path and executable file URL; actual runtime behavior supplies capability across platforms.
 * @evidence contracts/performance.md#efficient-algorithms One registration and sentinel resolution delegate to Node's current hook/require resolver, with cwd/path/file-URL text work and runtime-owned hook state. No fixture is created; fixed wrapper calls do not bound delegated resolution work or earlier hook costs.
 * @evidenceExclude contracts/performance.md#reuse-equivalent-work Each query observes current hook behavior and retains no answer or equivalent-request coordinator; the caller owns its installation decision.
 * @evidence contracts/performance.md#bound-retention-and-release-resources Finally invokes deregistration on the locally acquired hook after success or refusal; it creates no temporary file and retains no own registry. Supported cleanup errors are not caught or converted into false, and Node owns delegated hook state.
 */
function requireResolveConsultsHooks() {
  if (typeof Module.registerHooks !== "function") return false;
  const sentinel = `./.ttsc-require-resolve-probe-${process.pid}`;
  let consulted = false;
  let probe;
  try {
    probe = Module.registerHooks({
      resolve(specifier, context, nextResolve) {
        if (specifier !== sentinel) return nextResolve(specifier, context);
        consulted = true;
        return {
          shortCircuit: true,
          url: pathToFileURL(process.execPath).href,
        };
      },
    });
    Module.createRequire(path.join(process.cwd(), "noop.js")).resolve(sentinel);
  } catch {
    // A runtime that never consulted the hook refuses the sentinel.
  } finally {
    probe?.deregister();
  }
  return consulted;
}

module.exports = {
  createResolutionInputRecorder,
  observeResolutions,
  requireResolveConsultsHooks,
  moduleResolutionBaseSelects,
  observeImportSearchRoots,
  visitImportMappedCandidates,
  visitResolutionCandidates,
};
