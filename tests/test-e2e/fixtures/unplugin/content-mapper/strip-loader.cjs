const esbuild = require(process.env.TTSC_TEST_ESBUILD_ENTRY ?? "esbuild");
module.exports = function (source) {
  return esbuild.transformSync(source, {loader:"ts",format:"esm",target:"es2020"}).code;
};
