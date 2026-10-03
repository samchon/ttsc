declare const require: (id: string) => any;
declare const process: { cwd(): string; execPath: string };
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const job: string = path.join(process.cwd(), "generated", "job.ts");
fs.mkdirSync(path.dirname(job), { recursive: true });
const said: string[] = [];
for (const version of ["first", "second"]) {
  fs.writeFileSync(job, `const version: string = "${version}";\nconsole.log(version);\nexport {};\n`);
  const child = spawnSync(process.execPath, [job], { encoding: "utf8" });
  if (child.status !== 0) throw new Error(child.stderr);
  said.push(child.stdout.trim());
}
console.log(said.join(","));
export {};
