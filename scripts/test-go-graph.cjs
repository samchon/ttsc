const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { graphGoTestAddresses, selectGraphGoTests } = require("./ci/graph-go-test-selection.cjs");
const { copyGoTestsFlat } = require("./ci/go-test-overlay.cjs");

const PACKAGES = ["internal/graph", "internal/graphsymbols", "cmd/ttscgraph", "cmd/graphbench", "cmd/graphdump"];
const OS_ADDRESSES = new Set([
  "internal/graph/TestDumpSymlinkProjectPublishesMatchingBase",
  "internal/graph/TestDumpPathMapperCanonicalizesWindowsShortRoot",
  "cmd/ttscgraph/TestAuxiliaryIdentityStateTracksRetargetsNotSourceContents",
]);

/**
 * Run the graph's owning source units and necessary Git/kernel boundaries.
 *
 * Captured declaration addresses are checked against actual platform-aware Go
 * registration. Exact per-package selectors prevent the unit lane from running
 * an OS or Git boundary merely because both compile into the same test binary.
 * JSON run/pass/fail/skip events establish which selected original tests were
 * reached. A capability skip is reported as noncoverage, never as a passed case.
 * Every selected package finishes independently before aggregate failure.
 *
 * The default local command retains both populations. Setup's OS-only mode
 * selects the three existing kernel addresses, including the Windows build-tag
 * case only when Go registers it. It uses checkout graph source and its current
 * shim modules; it does not claim an installed SDK or build a product artifact.
 * This private CLI adapter is reviewed through its actual execution, not as an
 * independently eligible JavaScript Evidence host.
 */
function main() {
  const root = path.resolve(__dirname, "..");
  const cwd = fs.realpathSync.native(path.join(root, "packages", "ttsc"));
  const osOnly = process.argv.includes("--os-boundaries");
  const layer = osOnly ? "e2e" : process.env.TTSC_TEST_LAYER;
  if (layer && layer !== "unit" && layer !== "e2e")
    throw new Error(`unknown TTSC_TEST_LAYER: ${layer}`);
  const arguments_ = process.argv.slice(2).filter((argument) => argument !== "--os-boundaries");
  if (arguments_.length) throw new Error(`Unsupported Graph Go arguments: ${arguments_.join(" ")}`);
  const goRoot = path.join(os.homedir(), "go-sdk", "go", "bin");
  const env = {
    ...process.env,
    PATH: fs.existsSync(goRoot)
      ? `${goRoot}${path.delimiter}${process.env.PATH ?? ""}`
      : process.env.PATH,
  };
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-graph-go-test-"));
  let unknownReader = false;
  try {
    const inputs = [], replace = {};
    for (const pkg of PACKAGES) {
      const capturedDir = path.join(scratch, ...pkg.split("/"));
      fs.mkdirSync(capturedDir, { recursive: true });
      for (const name of fs.readdirSync(path.join(cwd, pkg)).sort().filter((name) => name.endsWith("_test.go"))) {
        const target = path.join(cwd, pkg, name);
        const contents = fs.readFileSync(target);
        const captured = path.join(capturedDir, name);
        fs.writeFileSync(captured, contents);
        replace[target] = captured;
        inputs.push({ package: pkg, file: `packages/ttsc/${pkg}/${name}`, source: contents.toString("utf8"), layer: "unit" });
      }
      const boundaryRoot = path.join(cwd, "test", "graph", "e2e", ...pkg.split("/"));
      if (fs.existsSync(boundaryRoot)) for (const captured of copyGoTestsFlat(boundaryRoot, capturedDir)) {
        const target = path.join(cwd, pkg, path.basename(captured.file));
        if (fs.existsSync(target) || Object.hasOwn(replace, target)) throw new Error(`Graph Go overlay collision: ${target}`);
        replace[target] = captured.copiedFile;
        inputs.push({ package: pkg, file: path.relative(root, captured.file).split(path.sep).join("/"), source: captured.source, layer: "e2e" });
      }
    }
    const overlay = path.join(scratch, "overlay.json");
    fs.writeFileSync(overlay, JSON.stringify({ Replace: replace }));
    const captureExit = (result) => {
      if (result.pid && (result.status === null || result.signal !== null)) unknownReader = true;
    };
    const addresses = graphGoTestAddresses(inputs);
    const registered = [];
    const failures = [];
    const selected = [];
    const moduleName = /^module\s+(\S+)/m.exec(fs.readFileSync(path.join(cwd, "go.mod"), "utf8"))?.[1];
    if (!moduleName) throw new Error("Graph Go module identity is missing");
    const relativePackage = (value) => {
      const prefix = `${moduleName}/`;
      if (typeof value !== "string" || !value.startsWith(prefix)) throw new Error(`Unexpected Go package identity: ${value}`);
      const pkg = value.slice(prefix.length);
      if (!PACKAGES.includes(pkg)) throw new Error(`Unowned Go package identity: ${value}`);
      return pkg;
    };
    for (const pkg of PACKAGES) {
      const list = cp.spawnSync("go", ["test", "-overlay", overlay, "-list=^Test", "-json", `./${pkg}`],
        { cwd, env, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
      captureExit(list);
      if (list.stdout) process.stdout.write(list.stdout);
      if (list.stderr) process.stderr.write(list.stderr);
      if (list.error || list.status !== 0) {
        if (list.error) console.error(list.error);
        failures.push(`${pkg}:registration`);
        continue;
      }
      try {
        const population = [];
        for (const line of list.stdout.split(/\r?\n/).filter(Boolean)) {
          const event = JSON.parse(line);
          if (event.Action !== "output") continue;
          const name = /^Test\w+\r?\n$/.exec(event.Output ?? "")?.[0].trim();
          if (name) {
            if (relativePackage(event.Package) !== pkg) throw new Error(`Unexpected Graph Go registration: ${event.Package}/${name}`);
            population.push({ package: pkg, name });
          }
        }
        registered.push(...population);
        if (!population.length) continue;
        // Validate every registered identity even when this layer selects none.
        const owned = selectGraphGoTests(addresses, population);
        selected.push(...owned.filter((entry) =>
          (!layer || entry.layer === layer) &&
          (!osOnly || OS_ADDRESSES.has(`${entry.package}/${entry.name}`)),
        ));
      } catch (error) {
        console.error(error);
        failures.push(`${pkg}:registration`);
      }
    }
    if (!selected.length) failures.push(`empty-${osOnly ? "os" : layer ?? "all"}-selection`);
    console.log(`Graph Go discovery: source=${addresses.length}, registered=${registered.length}, selected=${selected.length}, layer=${osOnly ? "os" : layer ?? "all"}`);
    for (const pkg of PACKAGES) {
      const cases = selected.filter((entry) => entry.package === pkg);
      if (!cases.length) continue;
      const names = new Set(cases.map((entry) => entry.name));
      const reached = new Set(), settled = new Set(), skipped = new Set();
      const run = cp.spawnSync("go", ["test", "-overlay", overlay, "-count=1", "-json", `-run=^(${[...names].join("|")})$`, `./${pkg}`],
        { cwd, env, encoding: "utf8", windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
      captureExit(run);
      if (run.stdout) process.stdout.write(run.stdout);
      if (run.stderr) process.stderr.write(run.stderr);
      if (run.error) { console.error(run.error); failures.push(pkg); continue; }
      let invalidEvents = false;
      for (const line of (run.stdout ?? "").split(/\r?\n/).filter(Boolean)) {
        try {
          const event = JSON.parse(line);
          if (!event.Test || event.Test.includes("/")) continue;
          if (relativePackage(event.Package) !== pkg || !names.has(event.Test)) throw new Error(`Unselected Graph Go execution: ${event.Package}/${event.Test}`);
          if (event.Action === "run") reached.add(event.Test);
          if (["pass", "fail", "skip"].includes(event.Action)) settled.add(event.Test);
          if (event.Action === "skip") skipped.add(event.Test);
        } catch (error) {
          invalidEvents = true;
          console.error(error);
        }
      }
      console.log(`Graph Go ${pkg}: selected=${names.size}, reached=${reached.size}, settled=${settled.size}, capability-skipped=${skipped.size}`);
      if (skipped.size) console.log(`Graph Go noncoverage: ${[...skipped].join(", ")}`);
      if (invalidEvents || run.status !== 0 || reached.size !== names.size || settled.size !== names.size) failures.push(pkg);
    }
    if (failures.length) console.error(`Graph Go failures: ${failures.join(", ")}`);
    return failures.length ? 1 : 0;
  } finally {
    if (unknownReader) console.error(`Graph Go input retention: unresolved process readers; retained ${scratch}`);
    else fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (require.main === module) {
  try { process.exitCode = main(); }
  catch (error) { console.error(error); process.exitCode = 1; }
}

module.exports = { main };
