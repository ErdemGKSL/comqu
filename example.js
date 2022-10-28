const { CLI } = require(".");

const cli = new CLI({ spinner: "dots" })
  .command({
    name: "test sub-cmd",
    description: "Test description",
    aliases: ["foo"],
    async onExecute({argStr, parsedArgs}) {
      console.log(`SUB CMD ARGS: "${argStr}"`);
    },
    options: []
  })
  .command({
    name: "test",
    description: "Test description",
    aliases: [],
    async onExecute({argStr, parsedArgs}) {
      console.log(`RAW ARGS: "${argStr}"`);
      console.log("Parsed", parsedArgs._)
    },
    options: [
      {
        name: "param1",
        required: true,
      },
      {
        name: "keyparam1",
        key: "hi",
        required: true,
      },
      {
        name: "param2",
        required: false,
      },
    ]
  })
  .command({
    name: "spinner",
    description: "spinner test",
    async onExecute() {
      await new Promise(r=>setTimeout(r, 1000));
      cli.loadingText = "Omg!";
      await new Promise(r=>setTimeout(r, 1000));
      cli.loadingText = "wow!";
      await new Promise(r=>setTimeout(r, 1000));
      cli.loadingText = "cool!";
      await new Promise(r=>setTimeout(r, 1000));
      cli.loadingText = "xd!";
      await new Promise(r=>setTimeout(r, 1000));
    },
  })
  .command({
    name: "exit",
    description: "exits the application",
    async onExecute() {
      process.exit();
    },
  })
  .command({
    name: "clear",
    description: "clears the console",
    async onExecute() {
      console.clear();
    },
  })
  .command({
    name: "delimiter",
    description: "changes the delimiter",
    async onExecute(a) {
      cli.delimiter = a.parsedArgs.get(0);
    },
    options: [
      {
        name: "delimiter",
        required: true,
      }
    ]
  })
  .command({
    name: "test groups",
    description: "logs command groups",
    async onExecute(a) {
      if (!a.argStr) console.log(cli.commandGroups);
      else console.log(JSON.stringify(cli.commandGroups, null, 2))
    },
    options: [
      {
        name: "stringfy",
        required: false,
      }
    ]
  });

cli.on("render", (del, cl) => `${del}${cl || color("Insert Command", 90)}`);

cli.delimiter = "> ";

cli.show();

function color(str, ...c) {
  return `${c.map(i=>`\x1b[${i}m`).join("")}${str}\x1b[0m`;
}