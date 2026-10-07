declare function describe(name: string, body: () => void): void;
declare function it(name: string, body: () => void): void;
enum Expected { Value = "one" }
describe("second", () => it("uses the checked emit", () => {
  if (Expected.Value !== "one") throw new Error("wrong value");
}));
