const { TtscCompiler } = require(process.env.TTSC_ENV_PACKAGE_ENTRY);
const context = JSON.parse(process.env.TTSC_ENV_COMPILER_CONTEXT);
const inherited = new TtscCompiler({ ...context, env: {} }).transform();
const cleared = new TtscCompiler({
  ...context,
  env: { TTSC_TSGO_BINARY: undefined },
}).transform();
console.log(JSON.stringify({ inherited, cleared }));
