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
  let toolchain = request.toolchain;
  let artifact = request.artifact;
  if (!toolchain || !artifact) {
    const archives = path.join(request.root, "archives");
    fs.mkdirSync(archives);
    toolchain = await EvidenceBenchmarkToolchain.pack(request.repository, archives);
    const archive = path.join(archives, "evidence.tgz");
    await EvidenceBenchmarkToolchain.packPackage(
      request.repository,
      "packages/evidence",
      archive,
    );
    artifact = { name: "@ttsc/evidence", archive };
  }
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
  fs.writeFileSync(request.result, JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
