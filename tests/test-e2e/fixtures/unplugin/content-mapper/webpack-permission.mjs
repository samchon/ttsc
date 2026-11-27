import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ttsc from "@ttsc/unplugin/webpack";

const require = createRequire(import.meta.url);
const webpack = require(process.env.TTSC_TEST_WEBPACK_ENTRY ?? "webpack");
const root = process.cwd();
const permission = process.argv[2];
const expected = process.argv[3];
const artifacts = path.join(root, "node_modules", ".cache", "webpack-permission");
const outputDirectory = path.join(artifacts, "output");
const cacheDirectory = path.join(artifacts, "cache");
// Keep the bundler's own directory creation outside the compiler's project
// membership and finish it before the first generation captures its inputs.
fs.mkdirSync(outputDirectory, { recursive: true });
fs.mkdirSync(cacheDirectory, { recursive: true });
const options = { project: "tsconfig.json", ...(permission === "inherit" ? {} : { runExternalCode: permission === "true" }) };
const compiler = webpack({
  context: root, mode: "development", target: "node", devtool: false,
  entry: path.join(root,"index.ts"),
  output: { path: outputDirectory, filename: "bundle.cjs", library: {type:"commonjs2"} },
  resolve: {extensions:[".ts",".js"]},
  module: {rules:[{test:/\.ts$/, use:[{loader:path.join(root,"strip-loader.cjs")}]}]},
  plugins:[ttsc(options)],
  cache:{type:"filesystem",cacheDirectory},
  snapshot:{module:{hash:true,timestamp:false},resolve:{hash:true,timestamp:false},resolveBuildDependencies:{hash:true,timestamp:false},buildDependencies:{hash:true,timestamp:false}},
});
let stats;
try {
  stats = await new Promise((resolve,reject)=>compiler.run((error,value)=>error?reject(error):value?resolve(value):reject(Error("missing webpack stats"))));
} finally {
  await new Promise((resolve,reject)=>compiler.close((error)=>error?reject(error):resolve()));
}
const report = stats.toString({all:false,errors:true,colors:false});
if(expected === "denied") {
  assert.equal(stats.hasErrors(),true,"the persistent host must not restore output compiled with permission: "+report);
  assert.match(report,/18068|Content mappers require/);
  console.log("webpack-permission:denied");
} else {
  assert.equal(stats.hasErrors(),false,report);
  assert.equal(require(path.join(outputDirectory,"bundle.cjs")).value.label,"ok");
  const source = [...stats.compilation.modules].find((module)=>module.resource===path.join(root,"index.ts"));
  assert.ok(source,"the actual entry module must be present");
  const built = stats.compilation.builtModules.has(source);
  assert.equal(built,expected === "built","the actual module build/restoration must match its invocation epoch");
  console.log("webpack-permission:"+(built?"built":"restored"));
}
