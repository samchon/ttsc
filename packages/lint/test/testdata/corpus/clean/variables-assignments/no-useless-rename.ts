// @ttsc-corpus-clean: no-useless-rename
const obj: any = { foo: 1 }; const { foo: renamed } = obj; const { foo } = obj;
