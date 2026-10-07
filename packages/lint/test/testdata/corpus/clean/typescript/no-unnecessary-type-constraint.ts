// @ttsc-corpus-clean: typescript/no-unnecessary-type-constraint
function identity<T extends string>(value: T): T { return value; }
