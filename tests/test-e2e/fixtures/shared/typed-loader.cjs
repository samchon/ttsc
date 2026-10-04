const { transform } = require("__ESBUILD_ENTRY__");
module.exports = function (source, incomingMap) {
  const done = this.async();
  transform(source, { loader: this.resourcePath.endsWith(".tsx") ? "tsx" : "ts", jsxFactory: "jsx", format: "esm", target: "es2022", sourcemap: "external", sourcefile: this.resourcePath }).then(
    (result) => done(null, result.code, JSON.parse(result.map)),
    (error) => done(error),
  );
};

