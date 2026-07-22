const fs = require("fs");
const moduleApi = require("module");
const path = require("path");

const DEFAULT_WEBSITE_ROOT = path.resolve(__dirname, "..");
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".mts", ".cts", ".d.ts"];
const RUNTIME_EXTENSIONS = [".js", ".cjs", ".mjs"];
const TYPE_EXTENSIONS = [
  ".d.ts",
  ".d.mts",
  ".d.cts",
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
];
const BUILTINS = new Set(
  moduleApi.builtinModules.flatMap((name) => [name, `node:${name}`]),
);

function createTypiaDependencyGraph(options = {}) {
  const websiteRoot = path.resolve(options.websiteRoot ?? DEFAULT_WEBSITE_ROOT);
  const repoRoot = path.resolve(websiteRoot, "..");
  const requestedRoot =
    options.typiaRoot ?? path.join(websiteRoot, "node_modules", "typia");
  const typiaRoot = realPackageRoot(requestedRoot, "typia");
  const typiaManifest = readManifest(typiaRoot);
  const expectedVersion =
    options.expectedVersion ??
    (options.typiaRoot ? typiaManifest.version : readExactTypiaPin(repoRoot));
  if (typiaManifest.version !== expectedVersion) {
    throw new Error(
      `[typia-graph] installed typia ${typiaManifest.version} does not match exact workspace pin ${expectedVersion}`,
    );
  }
  const goAdapterRoot = path.join(typiaRoot, "native", "adapter");
  if (!fs.existsSync(goAdapterRoot)) {
    throw new Error(
      `[typia-graph] authoritative typia install has no native adapter: ${goAdapterRoot}`,
    );
  }

  return {
    version: typiaManifest.version,
    typiaRoot,
    goAdapterRoot,
    collect(kind) {
      if (!new Set(["source", "runtime", "types"]).has(kind)) {
        throw new Error(
          `[typia-graph] unknown closure kind ${JSON.stringify(kind)}`,
        );
      }
      return collectClosure({
        kind,
        root: typiaRoot,
        manifest: typiaManifest,
        expectedVersion,
      });
    },
  };
}

function collectClosure({ kind, root, manifest, expectedVersion }) {
  const packages = new Map();
  const files = new Map();
  const queued = [];
  const visited = new Set();

  registerPackage(packages, manifest.name, root, manifest, expectedVersion);
  for (const entry of rootEntrypoints(root, manifest, kind)) {
    queued.push({
      file: entry,
      packageName: manifest.name,
      packageRoot: root,
      chain: [],
    });
  }

  while (queued.length > 0) {
    const current = queued.shift();
    const real = fs.realpathSync(current.file);
    if (visited.has(real)) continue;
    visited.add(real);
    const rel = slash(path.relative(current.packageRoot, real));
    if (rel === ".." || rel.startsWith("../")) {
      throw new Error(
        `[typia-graph] resolved file escaped package root: ${real}`,
      );
    }
    const key = `${current.packageName}/${rel}`;
    if (kind === "runtime" && real.endsWith(".mjs")) {
      throw new Error(
        `[typia-graph] ${formatImportChain(current.chain, key)} resolves to an ESM-only runtime module; the playground Execute sandbox requires CommonJS`,
      );
    }
    files.set(key, real);

    const text = fs.readFileSync(real, "utf8");
    for (const specifier of parseModuleSpecifiers(text)) {
      if (BUILTINS.has(specifier) || specifier.startsWith("node:")) continue;
      if (specifier.startsWith(".") || specifier.startsWith("/")) {
        const target = resolveFile(
          path.resolve(path.dirname(real), specifier),
          kind,
        );
        if (!target) {
          throw new Error(
            `[typia-graph] ${formatImportChain(current.chain, key)} imports missing ${JSON.stringify(specifier)}`,
          );
        }
        queued.push({
          ...current,
          file: target,
          chain: [...current.chain, key],
        });
        continue;
      }

      const { packageName, subpath } = splitPackageSpecifier(specifier);
      const dependencyRoot = findDependencyRoot(
        current.packageRoot,
        packageName,
      );
      if (!dependencyRoot) {
        throw new Error(
          `[typia-graph] ${formatImportChain(current.chain, key)} imports missing package ${JSON.stringify(packageName)}`,
        );
      }
      const dependencyManifest = readManifest(dependencyRoot);
      if (dependencyManifest.name !== packageName) {
        throw new Error(
          `[typia-graph] resolved ${packageName} to manifest ${dependencyManifest.name} at ${dependencyRoot}`,
        );
      }
      registerPackage(
        packages,
        packageName,
        dependencyRoot,
        dependencyManifest,
        expectedVersion,
      );
      const target = resolvePackageImport(
        dependencyRoot,
        dependencyManifest,
        subpath,
        kind,
      );
      if (!target) {
        throw new Error(
          `[typia-graph] ${formatImportChain(current.chain, key)} cannot resolve ${JSON.stringify(specifier)} for ${kind}`,
        );
      }
      queued.push({
        file: target,
        packageName,
        packageRoot: dependencyRoot,
        chain: [...current.chain, key],
      });
    }
  }

  return { kind, version: expectedVersion, packages, files };
}

function rootEntrypoints(root, manifest, kind) {
  const entries = [];
  const rootExport = manifest.exports?.["."];
  const rootTarget = selectTarget(rootExport, manifest, kind);
  if (!rootTarget) {
    throw new Error(`[typia-graph] typia has no ${kind} root entrypoint`);
  }
  const resolvedRoot = resolveManifestTarget(root, rootTarget, kind);
  if (!resolvedRoot) {
    throw new Error(
      `[typia-graph] typia ${kind} root entrypoint is missing: ${rootTarget}`,
    );
  }
  entries.push(resolvedRoot);

  for (const [subpath, value] of Object.entries(manifest.exports ?? {})) {
    if (subpath === "." || subpath === "./package.json") continue;
    const target = selectConditionalTarget(value, kind);
    if (typeof target !== "string") continue;
    if (target.includes("*")) {
      entries.push(...expandWildcardTarget(root, target, kind));
      continue;
    }
    const resolved = resolveManifestTarget(root, target, kind);
    if (!resolved) {
      throw new Error(
        `[typia-graph] typia ${kind} export ${JSON.stringify(subpath)} is missing: ${target}`,
      );
    }
    entries.push(resolved);
  }
  return [...new Set(entries.map((entry) => fs.realpathSync(entry)))];
}

function resolvePackageImport(root, manifest, subpath, kind) {
  if (subpath === "") {
    const target = selectTarget(manifest.exports?.["."], manifest, kind);
    return target ? resolveManifestTarget(root, target, kind) : null;
  }
  const key = `./${subpath}`;
  const direct = manifest.exports?.[key];
  if (direct !== undefined) {
    const target = selectConditionalTarget(direct, kind);
    return typeof target === "string"
      ? resolveManifestTarget(root, target, kind)
      : null;
  }
  for (const [pattern, value] of Object.entries(manifest.exports ?? {})) {
    if (!pattern.includes("*")) continue;
    const [prefix, suffix] = pattern.split("*");
    if (!key.startsWith(prefix) || !key.endsWith(suffix)) continue;
    const wildcard = key.slice(prefix.length, key.length - suffix.length);
    const target = selectConditionalTarget(value, kind);
    if (typeof target !== "string") return null;
    return resolveManifestTarget(root, target.replace("*", wildcard), kind);
  }
  return resolveFile(path.join(root, subpath), kind);
}

function selectTarget(rootExport, manifest, kind) {
  const exported = selectConditionalTarget(rootExport, kind);
  if (typeof exported === "string") return exported;
  if (kind === "types")
    return manifest.types ?? manifest.typings ?? manifest.main;
  if (kind === "source")
    return manifest.types ?? manifest.typings ?? manifest.main;
  return manifest.main;
}

function selectConditionalTarget(value, kind) {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const conditions =
    kind === "types" || kind === "source"
      ? ["types", "default", "import", "require"]
      : ["require", "default"];
  for (const condition of conditions) {
    const selected = selectConditionalTarget(value[condition], kind);
    if (selected) return selected;
  }
  return null;
}

function resolveManifestTarget(root, target, kind) {
  let relative = target.replace(/^\.\//, "");
  if (kind === "source") relative = mapPublishedPathToSource(root, relative);
  return resolveFile(path.join(root, relative), kind);
}

function mapPublishedPathToSource(root, relative) {
  const mapped = relative
    .replace(/^lib\//, "src/")
    .replace(/\.d\.(?:mts|cts|ts)$/, ".ts")
    .replace(/\.(?:mjs|cjs|js)$/, ".ts");
  if (mapped.includes("*") && fs.existsSync(path.join(root, "src")))
    return mapped;
  return resolveFile(path.join(root, mapped), "source") ? mapped : relative;
}

function expandWildcardTarget(root, target, kind) {
  let relative = target.replace(/^\.\//, "");
  if (kind === "source") relative = mapPublishedPathToSource(root, relative);
  const star = relative.indexOf("*");
  const prefix = relative.slice(0, star);
  const suffix = relative.slice(star + 1);
  const searchRoot = path.join(root, path.dirname(prefix));
  if (!fs.existsSync(searchRoot)) {
    throw new Error(
      `[typia-graph] wildcard export root is missing: ${searchRoot}`,
    );
  }
  return walkFiles(searchRoot).filter((file) => {
    const rel = slash(path.relative(root, file));
    return (
      rel.startsWith(prefix) &&
      rel.endsWith(suffix) &&
      extensionAllowed(rel, kind)
    );
  });
}

function resolveFile(base, kind) {
  const extensions =
    kind === "source"
      ? SOURCE_EXTENSIONS
      : kind === "runtime"
        ? RUNTIME_EXTENSIONS
        : TYPE_EXTENSIONS;
  const candidates = [base];
  for (const extension of extensions) candidates.push(`${base}${extension}`);
  for (const extension of extensions)
    candidates.push(path.join(base, `index${extension}`));
  for (const candidate of candidates) {
    try {
      if (fs.statSync(candidate).isFile()) return fs.realpathSync(candidate);
    } catch {
      // Continue through the deterministic extension list.
    }
  }
  return null;
}

function extensionAllowed(file, kind) {
  if (kind === "source") return /\.(?:ts|tsx|mts|cts)$/.test(file);
  if (kind === "runtime") return /\.(?:js|cjs|mjs)$/.test(file);
  return /(?:\.d)?\.(?:ts|tsx|mts|cts)$/.test(file);
}

function parseModuleSpecifiers(text) {
  const stripped = stripComments(text);
  const found = new Set();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?(?:[^"']*?\s+from\s*)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\brequire\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of stripped.matchAll(pattern)) found.add(match[1]);
  }
  return [...found];
}

function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function registerPackage(packages, name, root, manifest, expectedVersion) {
  const existing = packages.get(name);
  const real = fs.realpathSync(root);
  if (existing && existing.root !== real) {
    throw new Error(
      `[typia-graph] package ${name} resolved to two installations: ${existing.root} and ${real}`,
    );
  }
  if (name.startsWith("@typia/") && manifest.version !== expectedVersion) {
    throw new Error(
      `[typia-graph] ${name}@${manifest.version} does not match typia@${expectedVersion}`,
    );
  }
  packages.set(name, { name, root: real, manifest });
}

function findDependencyRoot(fromPackageRoot, packageName) {
  let current = fs.realpathSync(fromPackageRoot);
  while (true) {
    const candidate = path.join(
      current,
      "node_modules",
      ...packageName.split("/"),
    );
    try {
      return realPackageRoot(candidate, packageName);
    } catch {
      // Keep walking through the pnpm virtual-store ancestry.
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function realPackageRoot(candidate, expectedName) {
  const real = fs.realpathSync(candidate);
  const manifest = readManifest(real);
  if (manifest.name !== expectedName) {
    throw new Error(
      `[typia-graph] expected ${expectedName} at ${candidate}, found ${manifest.name}`,
    );
  }
  return real;
}

function readManifest(root) {
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) {
    throw new Error(`[typia-graph] missing package.json: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readExactTypiaPin(repoRoot) {
  const workspace = fs.readFileSync(
    path.join(repoRoot, "pnpm-workspace.yaml"),
    "utf8",
  );
  const samchon =
    workspace.match(/\n  samchon:\r?\n([\s\S]*?)(?:\n  [a-zA-Z]|$)/)?.[1] ?? "";
  const version = samchon.match(
    /^    typia:\s+(?:&[^\s#]+\s+)?['"]?([^'"\s#]+)['"]?/m,
  )?.[1];
  if (!version || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(
      `[typia-graph] catalogs.samchon.typia must be one exact version, found ${JSON.stringify(version)}`,
    );
  }
  return version;
}

function splitPackageSpecifier(specifier) {
  const parts = specifier.split("/");
  if (specifier.startsWith("@")) {
    return {
      packageName: parts.slice(0, 2).join("/"),
      subpath: parts.slice(2).join("/"),
    };
  }
  return { packageName: parts[0], subpath: parts.slice(1).join("/") };
}

function walkFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) files.push(full);
    }
  }
  return files.sort();
}

function rewriteSourceManifest(manifest, packageRoot) {
  const hasSourceTree =
    packageRoot && fs.existsSync(path.join(packageRoot, "src"));
  const rewrite = (value) => {
    if (typeof value === "string") {
      if (!hasSourceTree || !/^(?:\.\/)?lib\//.test(value)) return value;
      return value
        .replace(/^(\.\/)?lib\//, "$1src/")
        .replace(/\.d\.(?:mts|cts|ts)$/, ".ts")
        .replace(/\.(?:mjs|cjs|js)$/, ".ts");
    }
    if (!value || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(rewrite);
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, rewrite(child)]),
    );
  };
  const output = { ...manifest };
  if (output.main) output.main = rewrite(output.main);
  if (output.module) output.module = rewrite(output.module);
  if (output.types) output.types = rewrite(output.types);
  if (output.typings) output.typings = rewrite(output.typings);
  if (output.exports) output.exports = rewrite(output.exports);
  return output;
}

function formatImportChain(chain, key) {
  return [...chain, key].join(" -> ");
}

function slash(value) {
  return value.split(path.sep).join("/");
}

module.exports = {
  createTypiaDependencyGraph,
  parseModuleSpecifiers,
  readExactTypiaPin,
  rewriteSourceManifest,
};
