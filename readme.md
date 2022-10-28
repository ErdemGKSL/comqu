![comqu](https://raw.githubusercontent.com/ErdemGKSL/comqu/main/logo.png)

## Example
```js
const { CLI } = require("comqu");

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
    name: "exit",
    description: "exits the application",
    async onExecute() {
      process.exit();
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

cli.delimiter = "> ";

cli.show();
```
