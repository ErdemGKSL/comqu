const { CLI } = require(".");

const cli = new CLI()
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
    aliases: ["foo"],
    async onExecute({argStr, parsedArgs}) {
      console.log(`RAW ARGS: "${argStr}"`);
      console.log("Parsed", parsedArgs._)
    },
    options: [
      {
        name: "param1",
        required: false,
      },
      {
        name: "param2",
        required: false,
      },
    ]
  })

cli.delimiter = "> ";

cli.start();