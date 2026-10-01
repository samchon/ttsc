exports.transform = async function (params) {
  const before = params.src.slice(0, params.src.indexOf("value")).split("\n");
  const start = { line: before.length, column: before.at(-1).length };
  const end = { line: start.line, column: start.column + 5 };
  return {
    ast: {
      type: "File",
      program: { type: "Program", body: [{ type: "Identifier", name: "value", loc: { start, end } }] },
      shifted: start.line,
    },
  };
};
