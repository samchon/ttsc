// The owning scene explicitly builds these modules with the benchmark's typia
// transform before ordinary Node loads the actual preparation APIs.
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const request = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const { EvidenceBenchmarkWorkspace } = require(path.join(
    request.preparation,
    "EvidenceBenchmarkWorkspace.js",
  ));
  const { EvidenceBenchmarkToolchain } = require(path.join(
    request.preparation,
    "EvidenceBenchmarkToolchain.js",
  ));
  const { prepareArtifacts } = require(request.artifactPreparationRuntime);
  const { toolchain, artifact } = await prepareArtifacts(request, EvidenceBenchmarkToolchain);
  const started = performance.now();
  const result = await EvidenceBenchmarkWorkspace.prepareWorkspace({
    repository: request.repository,
    output: path.join(request.root, "prepared"),
    project: "todo",
    arm: "evidence",
    variables: {
      name: "benchmark-todo",
      apiPackageName: "@benchmark/todo-api",
      backendPackageName: "@benchmark/todo-backend",
      frontendPackageName: "@benchmark/todo-frontend",
    },
    toolchain,
    artifact,
  });
  console.info("TTSC_BACKEND_ARCHIVE_COST " + JSON.stringify({ phase: "materialize-install", elapsedMs: performance.now() - started }));
  fs.writeFileSync(request.result, JSON.stringify(result));
}

if (require.main === module) main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
