declare const __dirname: string;
declare function require(name: string): { readFileSync(file: string, encoding: string): string };
console.log(require("node:fs").readFileSync(__dirname + "/../template/no-outdir.txt", "utf8"));
console.log(__dirname);
export {};
