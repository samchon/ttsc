exports.transform = async (params) => {
  const ast = { source: params.src, filename: params.filename, options: params.options, plugins: params.plugins };
  if (params.filename === "src/bundle.ts") {
    const name = "authoredMarker";
    const offset = params.src.indexOf(name);
    if (offset < 0) throw new Error("the native source must retain the authored identifier");
    const before = params.src.slice(0, offset).split("\n");
    const start = { line: before.length, column: before.at(-1).length };
    ast.shifted = start.line;
    ast.type = "File";
    ast.program = { type: "Program", body: [{ type: "Identifier", name, loc: { start, end: { line: start.line, column: start.column + name.length } } }] };
  }
  return { ast };
};
exports.getCacheKey = () => "shared-authored-upstream";
