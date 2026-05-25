// expect: noUselessComputedKey error
const o = { ["foo"]: 1 };
JSON.stringify(o);
