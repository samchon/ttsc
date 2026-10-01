declare const first: number;
declare const second: number;
declare const flag: boolean;
declare const box: { value: number };
declare const tag: (strings: TemplateStringsArray) => string;

// expect: no-unused-expressions error
first;
// expect: no-unused-expressions error
box.value;
// expect: no-unused-expressions error
box["value"];
// expect: no-unused-expressions error
1;
// expect: no-unused-expressions error
123n;
// expect: no-unused-expressions error
"not a directive here";
// expect: no-unused-expressions error
`template ${first}`;
// expect: no-unused-expressions error
`no substitution`;
// expect: no-unused-expressions error
/pattern/;
// expect: no-unused-expressions error
true;
// expect: no-unused-expressions error
null;
// expect: no-unused-expressions error
[first, second];
// expect: no-unused-expressions error
({ first, second });
// expect: no-unused-expressions error
(() => first);
// expect: no-unused-expressions error
(function named(): number {
  return first;
});
// expect: no-unused-expressions error
(class Ephemeral {});
// expect: no-unused-expressions error
first === second;
// expect: no-unused-expressions error
first + second;
// expect: no-unused-expressions error
(first, second);
// expect: no-unused-expressions error
flag && first;
// expect: no-unused-expressions error
flag ? first : second;
// expect: no-unused-expressions error
typeof first;
// expect: no-unused-expressions error
-first;
// expect: no-unused-expressions error
!flag;
// expect: no-unused-expressions error
tag`value`;

function meta(): void {
  // expect: no-unused-expressions error
  new.target;
}

class Carrier {
  describe(): void {
    // expect: no-unused-expressions error
    this;
  }
}

void meta;
void Carrier;
