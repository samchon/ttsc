import { runNativeChildCorpus } from "./native-child-corpus";
declare const require: (id: string) => unknown;
declare const process: { cwd(): string; exitCode: number };
export {};
for (const [name, module] of [
  ["same-named", "./same-named"],
  ["raw-package", "./raw-package"],
] as const) {
  console.log("BEGIN:" + name);
  try { require(module); } catch (error) { console.log("FAILED:" + String(error)); process.exitCode = 1; }
  console.log("END:" + name);
}
console.log("tag=" + (globalThis as { tag?: string }).tag);
void runNativeChildCorpus(["rewrite"], process.cwd()).catch((error) => {
  console.log("FAILED:" + String(error));
  process.exitCode = 1;
});
