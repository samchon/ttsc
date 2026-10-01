declare const cy: any;
// expect: cypress/no-async-before error
beforeEach(async function () {
  await cy.get("button");
});
