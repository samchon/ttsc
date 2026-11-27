import childProcess from "node:child_process";
import fs from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TtsxNodeOptions } from "../../../../packages/ttsc/src/internal/TtsxNodeOptions";
import { javascriptRuntimeCapabilities } from "../../../../packages/ttsc/src/internal/javascriptRuntimeCapabilities";
import { CapabilityResolutionFormat } from "../../../../packages/ttsc/src/plugin/internal/CapabilityResolutionFormat";
import { PluginDescriptorEvaluationCache } from "../../../../packages/ttsc/src/plugin/internal/load/PluginDescriptorEvaluationCache";
import { hashHostInputPaths } from "../../../../packages/ttsc/src/plugin/internal/load/hashHostInputPaths";
import { realpathHostInputPaths } from "../../../../packages/ttsc/src/plugin/internal/load/realpathHostInputPaths";
import { PluginContentIdentities } from "../../../../packages/ttsc/src/plugin/internal/source/PluginContentIdentities";
import { writeCapabilityResolution } from "../../../../packages/ttsc/src/plugin/internal/writeCapabilityResolution";
import { resolveCapabilityPluginResolution } from "../../../../packages/ttsc/src/plugin/resolveCapabilityPlugins";

const { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE } = createRequire(
  import.meta.url,
)(
  "../../../../packages/ttsc/lib/plugin/internal/load/COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE.js",
) as { COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE: string };

interface ITraceRow {
  event: string;
  writerPid: number;
  data: {
    authority?: string | null;
    cacheHit?: boolean;
    origin?: string;
    phase?: string;
    proved?: boolean;
    reason?: string;
    runtimeProved?: boolean;
  };
}

const [cacheDir, projectDir, tsconfig, pluginFile, mode, alternateHome] =
  process.argv.slice(2);
const traceDir = process.env.TTSC_E2E_TRACE!;
const helperEnv = TtsxNodeOptions.forHelpers(process.env);
const runtimeHookPreload = fileURLToPath(
  new URL(
    "../../../../packages/ttsc/lib/launcher/internal/runtimeHookPreload.js",
    import.meta.url,
  ),
);

const readTraceRows = (): ITraceRow[] =>
  fs
    .readdirSync(traceDir)
    .filter((name) => name.endsWith(".jsonl"))
    .flatMap((name) =>
      fs
        .readFileSync(path.join(traceDir, name), "utf8")
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as ITraceRow),
    )
    // Synchronous probe and lookup rows are written by this actor. Child
    // writers may sort before it on one filesystem and after it on another.
    .filter((row) => row.writerPid === process.pid);

const store = PluginContentIdentities.open({
  projectRoot: projectDir!,
  cacheDir: cacheDir!,
  env: helperEnv,
});

const descriptorContext = {
  binary: "",
  cwd: projectDir!,
  dirname: projectDir!,
  filename: pluginFile!,
  plugin: { transform: pluginFile! },
  pluginConfigDir: projectDir!,
  projectRoot: projectDir!,
  tsconfig: path.join(projectDir!, tsconfig!),
};

const descriptorAuthority = {
  cacheDir: cacheDir!,
  context: descriptorContext,
  cwd: projectDir!,
  env: helperEnv,
  identities: store,
  projectRoot: projectDir!,
  request: pluginFile!,
  runtime: process.execPath,
  version: "trusted-preload-unit",
};
const descriptorLocation =
  PluginDescriptorEvaluationCache.locate(descriptorAuthority);
const descriptorDifferentGraphRefused =
  PluginDescriptorEvaluationCache.locate({
    ...descriptorAuthority,
    expectedPreloadGraph: [path.join(projectDir!, "different-preload.cjs")],
  }) === null;
const descriptorDifferentNodePathRefused =
  PluginDescriptorEvaluationCache.locate({
    ...descriptorAuthority,
    env: { ...helperEnv, NODE_PATH: path.join(projectDir!, "other-node-path") },
  }) === null;
const homeVariable = process.platform === "win32" ? "USERPROFILE" : "HOME";
const alternateHomeEnv =
  alternateHome === undefined
    ? undefined
    : { ...helperEnv, [homeVariable]: alternateHome };
let descriptorDifferentHomeRefused: boolean | undefined;
if (alternateHomeEnv !== undefined) {
  const original = process.env[homeVariable];
  try {
    // A running Node keeps its initialized search paths after an env edit.
    // Its child would initialize under the new home even when env now agrees.
    process.env[homeVariable] = alternateHomeEnv[homeVariable]!;
    descriptorDifferentHomeRefused =
      PluginDescriptorEvaluationCache.locate({
        ...descriptorAuthority,
        env: alternateHomeEnv,
      }) === null;
  } finally {
    if (original === undefined) delete process.env[homeVariable];
    else process.env[homeVariable] = original;
  }
}

let descriptorCacheHit = false;
let descriptorEvaluated = false;
let descriptorInputs: string[] = [];
let descriptorObservationsComplete: boolean | null = null;
let descriptorReadFailure: string | undefined;
let descriptorWriteAttempted = false;

const observedDescriptor = {
  hashes: new Map<string, string | null>(),
  realpaths: new Map<string, string | null>(),
};
const cachedDescriptor =
  descriptorLocation === null
    ? null
    : PluginDescriptorEvaluationCache.read(
        descriptorLocation,
        observedDescriptor,
      );
if (cachedDescriptor === null && descriptorLocation !== null) {
  try {
    const saved = JSON.parse(fs.readFileSync(descriptorLocation, "utf8")) as {
      proof?: {
        hashes?: Record<string, string | null>;
        realpaths?: Record<string, string | null>;
      };
    };
    const changed = (
      expected: Record<string, string | null> | undefined,
      observed: ReadonlyMap<string, string | null>,
    ) =>
      Object.keys(expected ?? {}).filter(
        (file) => expected![file] !== observed.get(file),
      );
    descriptorReadFailure = JSON.stringify({
      changedHashes: changed(saved.proof?.hashes, observedDescriptor.hashes),
      changedRealpaths: changed(
        saved.proof?.realpaths,
        observedDescriptor.realpaths,
      ),
    });
  } catch (error) {
    descriptorReadFailure = String(error);
  }
}
if (cachedDescriptor !== null) {
  descriptorCacheHit = true;
  descriptorInputs = cachedDescriptor.inputs;
  descriptorObservationsComplete = cachedDescriptor.observationsComplete;
} else if (mode === "evaluate" || mode === "seed-all") {
  descriptorEvaluated = true;
  const evalDir = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-eval-actor-"));
  const out = path.join(evalDir, "descriptor.json");
  const inputsOut = path.join(evalDir, "descriptor-inputs.ndjson");
  const shim = `${out}.cjs`;
  try {
    fs.writeFileSync(shim, COMMONJS_PLUGIN_DESCRIPTOR_SHIM_SOURCE);
    const evalResult = childProcess.spawnSync(
      process.execPath,
      ["--require", runtimeHookPreload, "--input-type", "", shim],
      {
        cwd: projectDir!,
        encoding: "utf8",
        env: {
          ...helperEnv,
          TTSC_PLUGIN_CONTEXT: JSON.stringify(descriptorContext),
          TTSC_PLUGIN_DESCRIPTOR_LOAD: "1",
          TTSC_PLUGIN_DESCRIPTOR_OUT: out,
          TTSC_PLUGIN_DESCRIPTOR_INPUTS_ACTIVE: "1",
          TTSC_PLUGIN_DESCRIPTOR_INPUTS_OUT: inputsOut,
          TTSC_PLUGIN_ENTRY: pluginFile!,
        },
        windowsHide: true,
      },
    );
    if (evalResult.status !== 0) {
      throw new Error(
        `descriptor evaluator failed (${String(evalResult.status)}): ${evalResult.stderr}`,
      );
    }
    const parsed = JSON.parse(fs.readFileSync(out, "utf8")) as {
      descriptor: unknown;
      inputHashes: Record<string, string | null>;
      inputRealpaths: Record<string, string | null>;
      inputs: string[];
      observation: { complete: boolean };
      startupPreloadFiles: string[] | null;
    };
    const evaluation: PluginDescriptorEvaluationCache.IEvaluation = {
      descriptor: parsed.descriptor,
      hostInputHashes: parsed.inputHashes,
      hostInputRealpaths: parsed.inputRealpaths,
      inputs: parsed.inputs,
      observationsComplete: parsed.observation.complete,
    };
    descriptorInputs = evaluation.inputs;
    descriptorObservationsComplete = evaluation.observationsComplete;
    if (
      descriptorLocation !== null &&
      parsed.startupPreloadFiles !== null &&
      PluginDescriptorEvaluationCache.locate({
        ...descriptorAuthority,
        expectedPreloadGraph: parsed.startupPreloadFiles,
      }) === descriptorLocation
    ) {
      descriptorWriteAttempted = true;
      PluginDescriptorEvaluationCache.write(descriptorLocation, evaluation);
    }
  } finally {
    fs.rmSync(evalDir, { recursive: true, force: true });
  }
}

const beforeProbeRows = readTraceRows().length;
const capabilities = javascriptRuntimeCapabilities(
  process.execPath,
  process.env,
  projectDir!,
  store,
);
const probeRows = readTraceRows().slice(beforeProbeRows);
const capabilityProbes = probeRows.filter(
  (row) =>
    row.event === "process-result" &&
    row.data.origin === "runtime-capability-probe",
).length;
const alternateHomeProbeStart = beforeProbeRows + probeRows.length;
const alternateHomeCapabilities =
  alternateHomeEnv === undefined
    ? undefined
    : javascriptRuntimeCapabilities(
        process.execPath,
        alternateHomeEnv,
        projectDir!,
        store,
      );
const alternateHomeProbes =
  alternateHomeEnv === undefined
    ? undefined
    : readTraceRows()
        .slice(alternateHomeProbeStart)
        .filter(
          (row) =>
            row.event === "process-result" &&
            row.data.origin === "runtime-capability-probe",
        ).length;
const alternateCwd = process.env.TTSC_TEST_PRELOAD_ALTERNATE_CWD;
const alternateCapabilities =
  alternateCwd === undefined
    ? undefined
    : javascriptRuntimeCapabilities(
        process.execPath,
        process.env,
        alternateCwd,
        store,
      );

const resolutionFile = CapabilityResolutionFormat.resolutionFile({
  cwd: projectDir!,
  tsconfig: tsconfig!,
  env: helperEnv,
  identities: store,
});

const beforeLookupRows = readTraceRows().length;
const resolution = resolveCapabilityPluginResolution({
  capability: "lsp",
  cwd: projectDir!,
  tsconfig: tsconfig!,
});
const lookupRows = readTraceRows().slice(beforeLookupRows);
const lookupEvent = lookupRows.find(
  (row) => row.event === "capability-resolution" && row.data.phase === "lookup",
);
const authorityEvent = lookupRows.find(
  (row) =>
    row.event === "capability-resolution" &&
    row.data.phase === "runtime-authority",
);

if (
  (mode === "seed-capability" || mode === "seed-all") &&
  resolutionFile !== null
) {
  const pkg = JSON.parse(
    fs.readFileSync(
      fileURLToPath(
        new URL("../../../../packages/ttsc/package.json", import.meta.url),
      ),
      "utf8",
    ),
  ) as { version: string };
  const tsconfigPath = path.join(projectDir!, tsconfig!);
  const manifestPath = path.join(projectDir!, "package.json");
  writeCapabilityResolution(
    {
      cwd: projectDir!,
      tsconfig: tsconfig!,
      version: pkg.version,
      env: helperEnv,
      identities: store,
    },
    {
      hostInputHashes: hashHostInputPaths([tsconfigPath, manifestPath]),
      hostInputRealpaths: realpathHostInputPaths([tsconfigPath, manifestPath]),
      hostInputs: [tsconfigPath, manifestPath],
      manifest: "[]",
      pluginSources: {},
      plugins: [],
      projectContext: null,
    },
  );
}

process.stdout.write(
  JSON.stringify({
    descriptorLocation,
    descriptorCacheHit,
    descriptorEvaluated,
    descriptorInputs,
    descriptorObservationsComplete,
    descriptorReadFailure,
    descriptorWriteAttempted,
    descriptorDifferentGraphRefused,
    descriptorDifferentNodePathRefused,
    descriptorDifferentHomeRefused,
    capabilities,
    alternateHomeCapabilities,
    alternateHomeProbes,
    alternateCapabilities,
    capabilityProbes,
    resolutionFile,
    runtimeProved: lookupEvent?.data.runtimeProved ?? null,
    capabilityAuthority: lookupEvent?.data.authority ?? null,
    capabilityCacheHit: lookupEvent?.data.cacheHit ?? null,
    capabilityIsCurrent: resolution.isCurrent(),
    runtimeAuthorityReason: authorityEvent?.data.reason ?? null,
  }),
);
