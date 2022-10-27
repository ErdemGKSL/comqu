const readline = require("readline");
const { plsParseArgs } = require("plsargs");
const { writeFileSync, appendFileSync } = require("fs");
const { debounce } = require("lodash")
/** @type {readline.Interface} */
let rl;

const ssh = [, , "nd", "rd"];
/** @typedef {{ name: string, required: boolean, key?: string }} Option */
/** @typedef {{ name: string, description: string, aliases: string[], options: Option[], onExecute: (args: { command: Command, trigger: string, argStr: string, parsedArgs: import("plsargs/dist/Result").Result }) => Promise<void>}} Command */
class CLI {

  #delimiter;
  /** @type {Command[]} */
  #commands;
  #started = false;;
  constructor() {
    this.#commands = [];
    /** @type {boolean} */
    this.exit = false;
  }

  /**
   * @param {Command} cmd 
   */
  command(cmd) {
    if (!cmd.options) cmd.options = [];
    cmd.options = [...cmd.options.filter(x => typeof x.key != "string"), ...cmd.options.filter(x => typeof x.key == "string")].map((option, i, options) => {
      if (!option.key) {
        if (option.required && options[i - 1] && !options[i - 1].required) throw Error("Required non-key options can not be after non-required non-key option!")
        option.key = i;
      } else {
        if (options.filter(x => x.key == option.key).length >= 2) throw Error("Key options can not represent same key!");
      }
      return option;
    });
    this.#commands.push(cmd);
    this.#commands.sort((x, y) => x.name.split(" ").length - y.name.split(" ").length);
    return this;
  }

  get commands() {
    return this.#commands.map(x => ({ ...x }));
  }

  start() {
    if (!this.#started) {
      if (!rl) rl = readline.createInterface({ input: process.stdin });
      this.#started = true;
      this.#fixConsole();
      this.#handle();
    }
  }

  set delimiter(v) {
    if (!this.#delimiter) {
      this.#delimiter = v?.toString?.() || this.delimiter;
    }
  }

  get delimiter() {
    return this.#delimiter || "~> ";
  }

  async #handle() {
    const input = await this.#seekInput();

    if (input == "help") {
      this.#help();
      return this.#handle();
    }

    /** @type {string} */
    let commandName;
    /** @type {Command} */
    const command = this.#commands.reverse().find((cmd) => {
      if (input.startsWith(cmd.name)) {
        commandName = cmd.name;
        return true;
      }
      const foundAliases = cmd.aliases?.find(a => input.startsWith(a));
      if (foundAliases) {
        commandName = foundAliases;
        return true;
      }
      return false;
    });
    this.#commands.reverse();
    if (!command) { this.responses.commandNotFound(); return this.#handle(); }
    const argStr = input.slice(commandName.length + 1).trim();
    const args = { argStr, parsedArgs: plsParseArgs(argStr), trigger: commandName, command };
    const validations = command.options.map(option => {
      if (option.required) {
        if (typeof option.key == "string") {
          if (args.parsedArgs.get(option.key)) return true;
          else {
            this.responses.requiredOption(commandName, `--${option.key} ${option.name}`);
            return false;
          }
        } else {
          if (args.parsedArgs._[option.key]) return true;
          else {
            this.responses.requiredOption(commandName, `${option.key + 1}${ssh[option.key + 1] || "th"} option`);
            return false;
          }
        }
      } else return true;
    });
    if (validations.every(x => x === true)) await command.onExecute(args);
    else this.responses.commandNotTriggered();
    if (!this.exit) this.#handle();
  }

  responses = {
    commandNotFound() { console.error("[comqu] Command not found!") },
    requiredOption(cmdName, optName) { console.warn(`[comqu] Option "${optName}" is required for "${cmdName}"`) },
    commandNotTriggered() { console.error("[comqu] Command is not executed.") },
  };

  #fixConsole() {
    const _write = process.stdout.write;
    const self = this;
    let lastLineOk = true;
    const logDelimiter = debounce(() => { _write.call(process.stdout, self.delimiter); lastLineOk = true; }, 10);
    process.stdout.write = function write(...args) {
      if (self.delimiter == args[0]) return logDelimiter();
      if (["\u001b[2K"].includes(args[0])) return _write.call(this, ...args);
      else {
        if (lastLineOk) {
          process.stdout.clearLine();
          lastLineOk = false;
        }
        _write.call(this, ...args);
        logDelimiter();
      }
    }
  }

  /** @returns {Promise<string>} */
  #seekInput() {
    return new Promise((res) => {
      process.stdout.write(this.#delimiter);

      rl.question("", (input) => {
        res(input);
      });
    })
  }

  /**
   * @returns {string} 
   */
  #help() {
    let result = "=== HELP ===";
    this.#commands.forEach(command => {
      result += `\n\n  Command: '${command.name}'`;
      if (command.aliases?.length) result += `\n  Aliases: ${command.aliases.map(x => `'${x}'`).join(", ")}`;
      if (command.description) result += "\n  Description: " + command.description;
      let usage = `${command.name}`;

      if (command.options?.length) {
        command.options.forEach(option => {
          usage += " " + this.#optionToString(option);
        })
      }
      result += `\n    Usage: ${usage}`
    });
    console.log(result)
  }

  /**
   * @param {Option} option
   * @returns {string}
   */
  #optionToString(option) {
    if (typeof option.key == "string") return option.required ? `< --${option.key} ${option.name} >` : `[ --${option.key} ${option.name} ]`
    else return option.required ? `<${option.name}>` : `[${option.name}]`
  }

}

module.exports.CLI = CLI;