const arr = [1, 2];
// expect: unicorn/no-useless-iterator-to-array error
for (const e of [...arr.entries()]) { void e; }
