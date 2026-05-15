const greeting = "hello"
const recipients = ["world", "agents"]

function announce(name: string) {
  return `${greeting}, ${name}`
}

for (const recipient of recipients) {
  JSON.stringify(announce(recipient))
}
