let a: any = 1;
// expect: no-delete-var error
delete a;
JSON.stringify(a);
