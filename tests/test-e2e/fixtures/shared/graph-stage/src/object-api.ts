export function GraphObjectHelper(): number { return 1; }
export const objectApi = {
  create<T>(value: T): number { return GraphObjectHelper(); },
  arrow: (): number => GraphObjectHelper(),
  nested: { key(): number { return GraphObjectHelper(); } },
  "nested.key"(): number { return GraphObjectHelper(); },
  'a[""]'(): number { return GraphObjectHelper(); },
  a: { ""(): number { return GraphObjectHelper(); } },
};
const objectAlias = objectApi;
export function GraphObjectCaller(): number {
  objectAlias.create(1); objectApi.arrow(); objectApi.nested.key();
  objectApi['a[""]'](); objectApi.a[""]();
  return objectApi["nested.key"]();
}
export function GraphFanoutRoot(): number { return 1; }
export function GraphFanoutCaller0(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller1(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller2(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller3(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller4(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller5(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller6(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller7(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller8(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller9(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller10(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller11(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller12(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller13(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller14(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller15(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller16(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller17(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller18(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller19(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller20(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller21(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller22(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller23(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller24(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller25(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller26(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller27(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller28(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller29(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller30(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller31(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller32(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller33(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller34(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller35(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller36(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller37(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller38(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller39(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller40(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller41(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller42(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller43(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller44(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller45(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller46(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller47(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller48(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller49(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller50(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller51(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller52(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller53(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller54(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller55(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller56(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller57(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller58(): number { return GraphFanoutRoot(); }
export function GraphFanoutCaller59(): number { return GraphFanoutRoot(); }
export function GraphDepth0(): number { return GraphDepth1(); }
export function GraphDepth1(): number { return GraphDepth2(); }
export function GraphDepth2(): number { return GraphDepth3(); }
export function GraphDepth3(): number { return GraphDepth4(); }
export function GraphDepth4(): number { return GraphDepth5(); }
export function GraphDepth5(): number { return GraphDepth6(); }
export function GraphDepth6(): number { return GraphDepth7(); }
export function GraphDepth7(): number { return GraphDepth8(); }
export function GraphDepth8(): number { return GraphDepth9(); }
export function GraphDepth9(): number { return GraphDepth10(); }
export function GraphDepth10(): number { return GraphDepth11(); }
export function GraphDepth11(): number { return GraphDepth12(); }
export function GraphDepth12(): number { return GraphDepth13(); }
export function GraphDepth13(): number { return GraphDepth14(); }
export function GraphDepth14(): number { return GraphDepth15(); }
export function GraphDepth15(): number { return GraphDepth16(); }
export function GraphDepth16(): number { return GraphDepth17(); }
export function GraphDepth17(): number { return GraphDepth18(); }
export function GraphDepth18(): number { return GraphDepth19(); }
export function GraphDepth19(): number { return GraphDepth20(); }
export function GraphDepth20(): number { return 1; }
