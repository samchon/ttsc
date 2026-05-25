const obj: any = { foo: 1 };
// expect: noUselessRename error
const { foo: foo } = obj;
JSON.stringify(foo);
