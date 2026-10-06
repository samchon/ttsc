import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { E2eProcessTrace } from "../../../utils/src/E2eProcessTrace";

import { WatchTopology } from "../../../../packages/ttsc/lib/launcher/internal/watch/WatchTopology.js";
import type { WatchInputChange } from "../../../../packages/ttsc/lib/launcher/internal/watch/WatchInputChange.js";
import { waitFor } from "../internal/unplugin/internal/adapter-vite-serve/waitFor";

/**
 * Verifies compiler membership and native notifications on one staged graph.
 *
 * 1. Register the actual compiler list, reference inputs and declared external data.
 * 2. Contrast authoritative declaration/JavaScript inputs with real predicted products.
 * 3. Exercise external references, reload targets and config recovery, then select
 *    the immutable execution-root and capability-gated case profiles.
 *
 * @evidence contracts/testing.md#behavioral-verification Actual built WatchTopology uses its native listFilesOnly reader and native observer. Explicit declaration/JS inputs survive predicted products; JSON/JS/declaration/build-info products stay out of the project lane, adjacent external data and referenced-project data deliver, and config deletion/recreation/replacement preserves subscription.
 * @evidence contracts/testing.md#independent-expectations Authored files/configuration define literal roles and filenames; each positive changes only its target after a settled ledger, while each quiet negative declares that precise predicted product. Filesystem identity is independently read for named delivery rather than assumed from platform spelling.
 * @evidence contracts/testing.md#distinguishing-cases Explicit declaration collision and mjs/cjs extension neighbors are compiler inputs; root/reference products contrast with adjacent JSON/document inputs. Missing config must report an error and still notify, then recreation/atomic replacement/ordinary edit must remain live. Available reload file aliases distinguish target edit and retarget.
 * @evidence contracts/testing.md#execution-ownership Selected esbuild starts one owned Node observer host to execute this helper. Up to three actual topology lifetimes serve mutable output configuration, immutable forwarded arguments and admitted case sensitivity. Native compiler-list refreshes remain actual costs, not one Program or zero preparation. Windows may perform two actual fsutil capability commands on owned directories.
 * @evidence contracts/e2e.md#necessary-boundary Native compiler membership and operating-system notification classification must agree across real subscriptions, products and config failures. Captured list/watch units own portable decision tables but do not establish these connections.
 * @evidence contracts/e2e.md#shared-execution One upfront project/reference graph serves all compatible distinctions. Constructors with different immutable forwarded arguments or output/case policies have distinct actual topology lifetimes in this same worker. No per-file host or installation is created. The separate Node owner allows the parent to join actual process termination because topology.close alone exposes no backend join.
 * @evidence contracts/e2e.md#state-isolation-and-reuse-validity This owned copied subtree and its allocated tools/src/main.js and tools/native-topology-javascript ancestor-output coordinates change; no other corpus claims those coordinates. Every transition settles prior attention, fixes the ledger boundary and distinguishes its own target or kind. Independent assertions collect failures; finally attempts each topology.close and records refusal without overwriting previous failures. The owning worker exits only after this body settles, and its parent independently observes ordinary status and PID departure before releasing the shared graph.
 * @evidence contracts/e2e.md#preserved-coverage Connects original authoritative declaration/JS extension and JSON/build-info/output quiet predicates, reference external-input notifications, missing-config recovery and root/ancestor/source-overlap/proper/noEmit layouts. Actual forwarded output coordinates retain distinct launcher/compiler execution roots and an adjacent JSON input. Case-distinct declared/glob inputs remain outside differently cased output boundaries when the native filesystem admits them; reload aliases likewise preserve the original capability boundary. Written assertions remain unexecuted until CI and do not certify every original ordering/performance premise.
 */
export async function nativeCompilerTopologyCorpus(root: string): Promise<void> {
  const config = path.join(root, "tsconfig.json");
  const configBytes = fs.readFileSync(config);
  const changes: WatchInputChange[] = [];
  const failures: unknown[] = [];
  const expectedConfigErrors: unknown[] = [];
  let allowMissingConfig = false;
  const topology = new WatchTopology({ cwd: root, files: [], projectRoot: root, tsconfig: config }, {
    onError: (location, error) => { if (allowMissingConfig) expectedConfigErrors.push(error); else failures.push(new Error("native compiler topology error at " + location, { cause: error })); },
    onInputChange: (change) => changes.push(change),
    onTopologyChange: () => undefined,
  });
  const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 500));
  const capture = async (name: string, body: () => Promise<void>) => { try { await body(); } catch (error) { failures.push(new Error(name, { cause: error })); } };
  const count = (kind: WatchInputChange["kind"]) => changes.filter((change) => change.kind === kind).length;
  const delivered = async (file: string, kind: WatchInputChange["kind"], stimulus: () => void) => {
    await settle();
    const before = changes.length;
    stimulus();
    await waitFor(() => changes.slice(before).some((change) => change.kind === kind && (change.path === undefined || (fs.existsSync(change.path) && fs.existsSync(file) && fs.realpathSync.native(change.path) === fs.realpathSync.native(file)))), kind + " delivery for " + file, 30000);
    await settle();
  };
  const quietProject = async (file: string) => {
    topology.setProjectInputs({ root, files: [file], globs: [] });
    await settle();
    const before = count("project");
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, "compiler product\n");
    await settle();
    assert.equal(count("project"), before, "predicted product retriggered project lane: " + file);
  };
  try {
    topology.refresh(false);
    for (const name of ["products/src/main.d.ts", "products/src/module.js", "products/src/common.js"])
      await capture("authoritative compiler input " + name, () => delivered(path.join(root, name), "compiler", () => fs.appendFileSync(path.join(root, name), "\n// edited\n")));
    for (const name of ["products/src/main.js", "products/src/main.js.map", "products/src/data.json", "products/src/module.mjs", "products/src/common.cjs", "packages/contract/api/state.json"])
      await capture("predicted product " + name, () => quietProject(path.join(root, name)));
    await capture("referenced project and external declared inputs", async () => {
      const external = path.join(root, "external/docs/spec.md");
      const api = path.join(root, "packages/contract/api/openapi.json");
      topology.setProjectInputs({ root, files: [external], globs: [path.join(root, "packages/contract/api/**/*.json")] });
      await delivered(external, "project", () => { fs.mkdirSync(path.dirname(external), { recursive: true }); fs.writeFileSync(external, "# External\n"); });
      await delivered(api, "project", () => fs.writeFileSync(api, "{}\n"));
    });
    await capture("adjacent JSON negative twin", async () => {
      const adjacent = path.join(root, "products/src/external.json");
      topology.setProjectInputs({ root, files: [adjacent], globs: [] });
      await delivered(adjacent, "project", () => fs.writeFileSync(adjacent, '{"external":true}\n'));
    });
    await capture("reload target and retarget", async () => {
      const declaration = path.join(root, "selection.json");
      const target = path.join(root, "external/selected.json");
      const replacement = path.join(root, "external/other.json");
      try { fs.symlinkSync(target, declaration, "file"); }
      catch (error) { if (["EPERM", "EACCES", "ENOTSUP"].includes((error as NodeJS.ErrnoException).code ?? "")) return; throw error; }
      topology.setProjectInputs({ root, files: [], globs: [], reloadFiles: [declaration] });
      await settle();
      let before = count("config");
      fs.writeFileSync(target, '{"plugin":"first-edited"}\n');
      await waitFor(() => count("config") > before, "native reload-target change", 30000);
      await settle();
      before = count("config");
      fs.unlinkSync(declaration);
      fs.symlinkSync(replacement, declaration, "file");
      await waitFor(() => count("config") > before, "native reload-alias retarget", 30000);
    });
    for (const [name, outDir, noEmit] of [
      ["project root", ".", false],
      ["project ancestor", "..", false],
      ["source-overlapping subtree", "src", false],
      ["proper product subtree", "products", false],
      ["analysis-only root", ".", true],
    ] as const)
      await capture("compiler population across " + name, async () => {
        topology.setProjectInputs({ root, files: [], globs: [] });
        const base = JSON.parse(configBytes.toString("utf8"));
        fs.writeFileSync(config, JSON.stringify({ ...base, compilerOptions: { ...base.compilerOptions, outDir, noEmit } }));
        topology.refresh(false);
        const source = path.join(root, "src/main.ts");
        await delivered(source, "compiler", () => fs.appendFileSync(source, "\n// source revision\n"));
        await settle();
        const before = count("compiler");
        const output = path.join(root, outDir, "src/main.js");
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "export const product = 2;\n");
        await settle();
        assert.equal(count("compiler"), before, name + ": JavaScript product retriggered compiler population");
        if (outDir !== "products") {
          const external = path.join(root, outDir === "src" ? "src/external.json" : "external.json");
          topology.setProjectInputs({ root, files: [external], globs: [] });
          await delivered(external, "project", () => fs.writeFileSync(external, '{"external":true}\n'));
        }
      });
    await capture("missing config and recovery", async () => {
      await settle();
      allowMissingConfig = true;
      let before = count("config");
      fs.unlinkSync(config);
      await waitFor(() => count("config") > before, "deleted config attention", 30000);
      assert.ok(expectedConfigErrors.length > 0, "failed native refresh must remain observable");
      before = count("config");
      fs.writeFileSync(config, configBytes);
      await waitFor(() => count("config") > before, "recreated config attention", 30000);
      await settle();
      allowMissingConfig = false;
      const replacement = path.join(root, "tsconfig.next.json");
      fs.writeFileSync(replacement, configBytes);
      await settle();
      before = count("config");
      fs.renameSync(replacement, config);
      await waitFor(() => count("config") > before, "atomic config replacement attention", 30000);
      await settle();
      before = count("config");
      fs.appendFileSync(config, "\n");
      await waitFor(() => count("config") > before, "post-replacement config edit", 30000);
    });
  } finally { try { topology.close(); } catch (error) { failures.push(new Error("native compiler topology close failed", { cause: error })); } }
  await capture("launcher and compiler execution roots", async () => {
    fs.writeFileSync(config, JSON.stringify({ files: ["src/main.ts"] }));
    const forwardedChanges: WatchInputChange[] = [];
    const forwarded = new WatchTopology({
      cwd: path.dirname(root), files: [], projectRoot: root, tsconfig: config,
      outDir: "native-topology-javascript",
      passthrough: ["--rootDir", ".", "--declaration", "--declarationDir", "types", "--incremental", "--tsBuildInfoFile", "cache/state.tsbuildinfo"],
    }, {
      onError: (location, error) => failures.push(new Error("forwarded topology error at " + location, { cause: error })),
      onInputChange: (change) => forwardedChanges.push(change),
      onTopologyChange: () => undefined,
    });
    const projectCount = () => forwardedChanges.filter((change) => change.kind === "project").length;
    try {
      forwarded.refresh(false);
      for (const output of [
        path.join(path.dirname(root), "native-topology-javascript/src/main.js"),
        path.join(root, "types/src/main.d.ts"),
        path.join(root, "cache/state.tsbuildinfo"),
      ]) {
        forwarded.setProjectInputs({ root, files: [output], globs: [] });
        await settle();
        const before = projectCount();
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, "compiler product\n");
        await settle();
        assert.equal(projectCount(), before, "compiler-facing execution root: " + output);
      }
      const nearby = path.join(root, "cache/external.json");
      forwarded.setProjectInputs({ root, files: [nearby], globs: [] });
      await settle();
      const before = projectCount();
      fs.writeFileSync(nearby, '{"external":true}\n');
      await waitFor(() => projectCount() > before, "forwarded build-info adjacent external input", 30000);
    } finally {
      try { forwarded.close(); }
      catch (error) { failures.push(new Error("forwarded topology close failed", { cause: error })); }
    }
  });
  await capture("case-distinct output and external input", async () => {
    const external = path.join(root, "external/case-profile");
    fs.mkdirSync(external, { recursive: true });
    if (process.platform === "win32") {
      const enabled = E2eProcessTrace.spawnSync("fsutil.exe", ["file", "setCaseSensitiveInfo", external, "enable"], { encoding: "utf8", windowsHide: true });
      if (enabled.error !== undefined || enabled.status !== 0) return;
    }
    const outputRoot = path.join(external, "Output");
    const inputRoot = path.join(external, "output");
    fs.mkdirSync(outputRoot);
    try { fs.mkdirSync(inputRoot); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return; throw error; }
    assert.notEqual(fs.realpathSync.native(outputRoot), fs.realpathSync.native(inputRoot));
    const exactDirectory = path.join(external, "Exact/nested");
    fs.mkdirSync(exactDirectory, { recursive: true });
    if (process.platform === "win32") {
      const enabled = E2eProcessTrace.spawnSync("fsutil.exe", ["file", "setCaseSensitiveInfo", exactDirectory, "enable"], { encoding: "utf8", windowsHide: true });
      if (enabled.error !== undefined || enabled.status !== 0) return;
    }
    fs.writeFileSync(config, JSON.stringify({ compilerOptions: { declaration: true, declarationDir: outputRoot, incremental: true, rootDir: "src", tsBuildInfoFile: path.join(exactDirectory, "State.json") }, files: ["src/main.ts"] }));
    const caseChanges: WatchInputChange[] = [];
    let liveRoots: readonly string[] = [];
    const caseTopology = new WatchTopology({ cwd: root, files: [], projectRoot: root, tsconfig: config }, {
      onError: (location, error) => failures.push(new Error("case topology error at " + location, { cause: error })),
      onInputChange: (change) => caseChanges.push(change),
      onProjectInputWatchRoots: (roots) => { liveRoots = [...roots]; },
      onTopologyChange: () => undefined,
    });
    const exact = path.join(inputRoot, "nested/evidence.md");
    const exactInput = path.join(exactDirectory, "state.json");
    const globRoot = path.join(inputRoot, "api");
    fs.mkdirSync(globRoot);
    try {
      caseTopology.refresh(false);
      caseTopology.setProjectInputs({ root, files: [exact, exactInput], globs: [path.join(globRoot, "**/*.json")] });
      assert.deepEqual(liveRoots, [fs.realpathSync.native(path.join(external, "Exact")), fs.realpathSync.native(inputRoot)].sort());
      for (const file of [exact, exactInput, path.join(globRoot, "openapi.json")]) {
        await settle();
        const before = caseChanges.length;
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, "case-distinct input\n");
        await waitFor(() => caseChanges.slice(before).some((change) => change.kind === "project"), "case-distinct input attention: " + file, 30000);
      }
    } finally {
      try { caseTopology.close(); }
      catch (error) { failures.push(new Error("case topology close failed", { cause: error })); }
    }
  });
  if (failures.length) throw new AggregateError(failures, "native compiler-list topology distinctions");
}
