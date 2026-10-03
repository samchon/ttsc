// @ttsc-corpus-clean: unicorn/no-useless-iterator-to-array
const arr = [1,2]; for (const e of arr.entries()) { void e; }
