const cp = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { runIndependent } = require("./run-independent.cjs");

/** Partition filenames without importing excluded modules or splitting twins. */
function partitionFiles(locations, filter, workers) {
  if (!Number.isSafeInteger(workers) || workers < 1)
    throw new Error("TTSC_TEST_WORKERS must be a positive integer");
  const names = new Set();
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(path.join(directory, entry.name));
      else if (
        entry.name.startsWith("test_") &&
        entry.name.endsWith(".ts") &&
        filter(entry.name)
      )
        names.add(entry.name);
    }
  }
  for (const location of locations) visit(location);
  const count = Math.min(workers, names.size);
  const groups = Array.from({ length: count }, () => []);
  [...names]
    .sort()
    .forEach((name, index) => groups[index % groups.length].push(name));
  return groups;
}

/** Run isolated suites against one install and cache, collecting every verdict. */
async function runPool(groups, options = {}) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "ttsc-test-workers-"));
  try {
    return await runIndependent(
      groups,
      (names, index) =>
        new Promise((resolve) => {
          const manifest = path.join(scratch, `${index}.json`);
          fs.writeFileSync(manifest, JSON.stringify(names));
          const child = cp.spawn(
            process.execPath,
            options.args ?? [...process.execArgv, ...process.argv.slice(1)],
            {
              cwd: options.cwd ?? process.cwd(),
              stdio: options.stdio ?? "inherit",
              windowsHide: true,
              env: {
                ...process.env,
                ...options.env,
                TTSC_TEST_WORKER_FILES: manifest,
                TTSC_TEST_WORKERS: "1",
              },
            },
          );
          child.on("error", (error) => console.error(error));
          child.on("close", (code) => resolve(code ?? 1));
        }),
      groups.length || 1,
    );
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

module.exports = { partitionFiles, runPool };
