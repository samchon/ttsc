declare const require: (name: string) => any;
declare const process: { env: Record<string, string | undefined> };

/** Read native dependency publications during their owning host's lifetime. */
export function runNativeDependencyPublicationCorpus(
  projectRoot: string,
  physicalRootsAvailable: boolean,
): void {
  const fs = require("node:fs");
  const path = require("node:path");
  const failures: Error[] = [];
  const attempt = (name: string, work: () => void): void => {
    try { work(); } catch (cause) { failures.push(new Error(name, { cause })); }
  };
  console.log("BEGIN:native-declared-dependency-output");
  for (const file of ["src/inside.ts", "extra.ts"])
    attempt(file, () => console.log(require(path.join(projectRoot, "dep-publication", file)).value));
  console.log("END:native-declared-dependency-output");
  if (physicalRootsAvailable) {
    console.log("BEGIN:native-physical-dependency-roots");
    attempt("physical dependency publications", () => {
      const manifestPath = process.env.TTSX_RUNTIME_MANIFEST;
      if (!manifestPath) throw new Error("real runtime manifest is required");
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { depCacheDir: string };
      const before = new Set<string>(fs.readdirSync(manifest.depCacheDir).filter((name: string) => name.endsWith(".json")));
      let dep: any, dep2: any;
      attempt("linked dependency execution", () => { dep = require("physical-root-dep"); });
      attempt("ordinary dependency execution", () => { dep2 = require("physical-root-dep2"); });
      const fresh = fs.readdirSync(manifest.depCacheDir).filter((name: string) => name.endsWith(".json") && !before.has(name)) as string[];
      if (fresh.length !== 2) failures.push(new Error("expected exactly two fresh dependency publications: " + JSON.stringify(fresh)));
      for (const name of fresh)
        attempt("physical root " + name, () => {
          const published = JSON.parse(fs.readFileSync(path.join(manifest.depCacheDir, name), "utf8")).rootDir;
          if (typeof published !== "string" || fs.realpathSync.native(published) !== published)
            throw new Error("published dependency root must equal its physical path");
        });
      if (dep !== undefined && dep2 !== undefined) console.log("VALUE:" + dep.VALUE + "/" + dep2.VALUE2);
      console.log("PHYSICAL-ROOTS:" + fresh.length);
    });
    console.log("END:native-physical-dependency-roots");
  }
  if (failures.length) throw new AggregateError(failures, "native dependency publication corpus failed");
}
