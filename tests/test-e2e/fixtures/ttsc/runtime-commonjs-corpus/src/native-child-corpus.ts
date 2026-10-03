declare const require: (id: string) => any;
declare const process: { cwd(): string; execPath: string; exitCode?: number };
declare const __dirname: string;
const fs = require("node:fs");
const path = require("node:path");
const children = require("node:child_process");

/** Exact native child groups borrowed by their matching canonical profiles. */
export async function runNativeChildCorpus(groups: readonly ("propagation" | "fork" | "rewrite" | "concurrency")[], projectRoot: string): Promise<void> {
  const failures: Error[] = [];
  const group = async (name: string, work: () => void | Promise<void>): Promise<void> => {
    console.log("BEGIN:" + name);
    try { await work(); } catch (cause) { failures.push(new Error(name, {cause})); }
    // fork-child deliberately uses stdout.write without a trailing newline.
    console.log("\nEND:" + name);
  };
  if (groups.includes("propagation")) await group("native-loader-propagation", () => {
    const child = children.spawnSync(process.execPath, [path.join(__dirname, "propagated-worker.ts")], {stdio:"inherit",cwd:projectRoot});
    if(child.status !== 0) throw new Error("propagated worker failed: " + String(child.status));
  });
  if (groups.includes("fork")) await group("native-js-fork-rescue", () => new Promise<void>((resolve,reject) => {
    const child = children.fork(path.join(__dirname,"fork-child.js"), {stdio:"inherit",cwd:projectRoot});
    let failure: Error | undefined;
    child.once("error", (error: Error) => {failure=error;});
    child.once("close", (code: number | null) => failure !== undefined ? reject(failure) : code === 0 ? resolve() : reject(new Error("fork worker failed: " + String(code))));
  }));
  if (groups.includes("rewrite")) await group("native-rewritten-root", () => {
    const job = path.join(projectRoot, "generated", "job.ts");
    fs.mkdirSync(path.dirname(job), {recursive:true});
    const said: string[] = [], errors: Error[] = [];
    for(const version of ["first","second"]) {
      fs.writeFileSync(job, `const version: string = "${version}";\nconsole.log(version);\nexport {};\n`);
      const child = children.spawnSync(process.execPath, [job], {encoding:"utf8",cwd:projectRoot});
      if(child.status !== 0) errors.push(new Error("rewritten child failed: " + String(child.status), {cause:child.error ?? child.stderr}));
      said.push(typeof child.stdout === "string" ? child.stdout.trim() : "");
    }
    console.log(said.join(","));
    if(errors.length)throw new AggregateError(errors,"rewritten root children failed");
  });
  if (groups.includes("concurrency")) await group("native-concurrent-dependency", async () => {
    const launch = () => new Promise<number | null>((resolve,reject) => {
      const child = children.spawn(process.execPath, [path.join(__dirname,"concurrent-worker.ts")], {stdio:"inherit",cwd:projectRoot});
      let failure: Error | undefined;
      child.once("error", (error: Error) => {failure=error;});
      child.once("close", (code: number | null) => failure !== undefined ? reject(failure) : resolve(code));
    });
    const results = await Promise.allSettled([launch(),launch(),launch()]);
    const failed = results.filter(result => result.status === "rejected" || result.value !== 0);
    if(failed.length)throw new AggregateError(failed,"concurrent dependency children failed");
  });
  if(failures.length)throw new AggregateError(failures,"native child corpus failed");
}
