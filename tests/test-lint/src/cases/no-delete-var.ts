let a: any = 1;
// expect: noDeleteVar error
delete a;
JSON.stringify(a);
