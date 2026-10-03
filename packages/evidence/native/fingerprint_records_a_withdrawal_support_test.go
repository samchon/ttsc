package evidence

const withdrawalConfig = `{"claims":[{
  "type":"typescript",
  "files":["src/claim/**"],
  "symbol":"type",
  "reference":{
    "type":"typescript",
    "files":["src/spec/**"],
    "symbol":["type","property"],
    "requireReview":true
  }
}]}`
