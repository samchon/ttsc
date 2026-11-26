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

const [cacheDir, projectDir, tsconfig, pluginFile, mode] =
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
    );

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

const descriptorLocation = PluginDescriptorEvaluationCache.locate({
  cacheDir: cacheDir!,
  context: descriptorContext,
  cwd: projectDir!,
  env: helperEnv,
  identities: store,
  projectRoot: projectDir!,
  request: pluginFile!,
  runtime: process.execPath,
  version: "trusted-preload-unit",
});

let descriptorCacheHit = false;
let descriptorEvaluated = false;
let descriptorInputs: string[] = [];
let descriptorObservationsComplete: boolean | null = null;

const cachedDescriptor =
  descriptorLocation === null
    ? null
    : PluginDescriptorEvaluationCache.read(descriptorLocation);
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
    if (descriptorLocation !== null) {
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
    capabilities,
    capabilityProbes,
    resolutionFile,
    runtimeProved: lookupEvent?.data.runtimeProved ?? null,
    capabilityAuthority: lookupEvent?.data.authority ?? null,
    capabilityCacheHit: lookupEvent?.data.cacheHit ?? null,
    capabilityIsCurrent: resolution.isCurrent(),
    runtimeAuthorityReason: authorityEvent?.data.reason ?? null,
  }),
);
