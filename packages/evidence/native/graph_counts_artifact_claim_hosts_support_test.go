package evidence

const markdownClaimReferencePolicyConfig = `{"claims":[{
  "type":"markdown",
  "files":["claims/**"],
  "symbol":"h2",
  "reference":{
    "type":"markdown",
    "files":["docs/spec.md"],
    "symbol":"h2",
    "uniqueEvidence":true,
    "singleEvidencePerSymbol":true
  }
}]}`



const prismaClaimReferencePolicyConfig = `{"claims":[{
  "type":"prisma",
  "files":["prisma/schema.prisma"],
  "symbol":"model",
  "reference":{
    "type":"markdown",
    "files":["docs/spec.md"],
    "symbol":"h2",
    "uniqueEvidence":true,
    "singleEvidencePerSymbol":true
  }
}]}`
