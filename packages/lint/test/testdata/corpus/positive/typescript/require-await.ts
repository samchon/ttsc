// expect: typescript/require-await error
async function noAwait(): Promise<number> {
  return 0;
}
JSON.stringify(noAwait);
