const obj: any = { foo: 1 };
// expect: no-useless-rename error
const { foo: foo } = obj;
JSON.stringify(foo);
