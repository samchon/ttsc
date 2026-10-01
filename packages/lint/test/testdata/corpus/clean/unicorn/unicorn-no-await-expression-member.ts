// @ttsc-corpus-clean: unicorn/no-await-expression-member
async function f() { const result = await Promise.resolve({ a: 1 }); return result.a; }
