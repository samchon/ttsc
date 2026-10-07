// @ttsc-corpus-clean: unicorn/no-await-in-promise-methods
async function f() { await Promise.all([Promise.resolve(1), Promise.resolve(2)]); }
