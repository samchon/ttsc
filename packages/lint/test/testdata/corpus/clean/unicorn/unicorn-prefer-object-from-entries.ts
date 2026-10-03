// @ttsc-corpus-clean: unicorn/prefer-object-from-entries
const entries: Array<[string,number]> = [["a",1]]; const obj = Object.fromEntries(entries);
