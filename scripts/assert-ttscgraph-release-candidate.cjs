// Exercise the packaged Linux ttscgraph binary before a release can publish.
// The ordinary build workflow runs this while the candidate is still a pull
// request; the tag workflow repeats it after the release build and before the
// first Marketplace or npm side effect.

const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const binary = path.join(
  root,
  "packages",
  "ttsc-linux-x64",
  "bin",
  "ttscgraph",
);
const version = require(path.join(root, "package.json")).version;

if (!fs.existsSync(binary)) {
  throw new Error(`ttscgraph release smoke: binary does not exist: ${binary}`);
}

const reported = run(["--version"]).stdout.trim();
if (!reported.includes(version) || reported.includes("0.0.0-dev")) {
  throw new Error(
    `ttscgraph release smoke: ${JSON.stringify(reported)} does not carry release version ${version}`,
  );
}

const workspace = fs.mkdtempSync(
  path.join(os.tmpdir(), "ttscgraph-release-candidate-"),
);
try {
  const project = path.join(workspace, "app");
  const source = path.join(project, "src", "main.ts");
  const outside = path.join(workspace, "shared", "types.d.ts");
  fs.mkdirSync(path.dirname(source), { recursive: true });
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(
    path.join(project, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: { noEmit: true, strict: true, target: "ES2022" },
        files: ["src/main.ts", "../shared/types.d.ts"],
      },
      null,
      2,
    )}\n`,
  );
  fs.writeFileSync(
    source,
    'import type { ExternalShape } from "../../shared/types";\n' +
      "export const value: ExternalShape = { count: 1 };\n",
  );
  fs.writeFileSync(
    outside,
    "export interface ExternalShape { count: number; }\n",
  );

  const dumped = run([
    "dump",
    "--cwd",
    project,
    "--tsconfig",
    "tsconfig.json",
  ]).stdout;
  const graph = JSON.parse(dumped);
  if (graph.provenance?.schemaVersion !== 6) {
    throw new Error(
      `ttscgraph release smoke: dump schema is ${JSON.stringify(graph.provenance?.schemaVersion)}, want 6`,
    );
  }
  if (graph.tsconfig !== "tsconfig.json") {
    throw new Error(
      `ttscgraph release smoke: tsconfig coordinate is ${JSON.stringify(graph.tsconfig)}`,
    );
  }

  const sources = graph.provenance?.sources ?? [];
  if (!sources.some((entry) => entry.file === "../shared/types.d.ts")) {
    throw new Error(
      "ttscgraph release smoke: outside declaration is absent from the portable source manifest",
    );
  }
  if (!sources.some((entry) => entry.file.startsWith("bundled:///"))) {
    throw new Error(
      "ttscgraph release smoke: bundled compiler source is absent from the source manifest",
    );
  }
  if (
    !graph.nodes.some(
      (node) =>
        node.file === "../shared/types.d.ts" &&
        node.name === "ExternalShape" &&
        node.external === true,
    )
  ) {
    throw new Error(
      "ttscgraph release smoke: outside declaration did not retain its external portable identity",
    );
  }

  const portable = { ...graph, project: "" };
  const serialized = JSON.stringify(portable);
  const checkout = workspace.replaceAll("\\", "/");
  if (serialized.includes(workspace) || serialized.includes(checkout)) {
    throw new Error(
      "ttscgraph release smoke: producer-local checkout path escaped outside the project locator",
    );
  }
} finally {
  fs.rmSync(workspace, { recursive: true, force: true });
}

console.log(
  `ttscgraph release smoke: schema v6 portable manifest passed for ${version}`,
);

function run(args) {
  const result = cp.spawnSync(binary, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `ttscgraph release smoke: ${args.join(" ")} exited with ${result.status}: ${(result.stderr ?? "").trim()}`,
    );
  }
  return result;
}
