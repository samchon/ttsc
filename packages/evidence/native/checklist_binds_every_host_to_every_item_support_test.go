package evidence

const checklistDocument = `## No hardcoding {#no-hardcoding}

Fix the general logic instead of special-casing a fixture.

## No whack-a-mole {#no-whack-a-mole}

Seal the class of failure rather than the witness.
`

const checklistConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/**"],
  "symbol":"function",
  "reference":{
    "type":"markdown",
    "files":["docs/rules.md"],
    "symbol":"h2",
    "checklist":true
  }
}]}`
