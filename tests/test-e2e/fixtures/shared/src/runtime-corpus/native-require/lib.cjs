const typed = require("./shared.ts");
const served = require("./shared.js");
require("./plain.cjs");
delete require.cache[require.resolve("./plain.cjs")];
exports.value = typed.value + "," + served.value;
exports.properties = [typeof require.cache, typeof require.extensions, typeof require.resolve.paths].join(",");
