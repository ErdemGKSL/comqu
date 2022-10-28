const readline = require("readline");
const { plsParseArgs } = require("plsargs");
const {quickMap} = require("async-and-quick");
const spinners = require("cli-spinners");
/** @type {readline.Interface} */
let rl;

const shh = [, , "nd", "rd"];
/** @typedef {{ name: string, required: boolean, key?: string }} Option */
/** @typedef {{ name: string, description: string, aliases: string[], options: Option[], onExecute: (args: { command: Command, trigger: string, argStr: string, parsedArgs: import("plsargs/dist/Result").Result }) => Promise<void>}} Command */
class CLI {

  #delimiter = "~> ";
  /** @type {Command[]} */
  #commands;
  #started = false;
  /** @type {string} */
  #currentLine;
  #loading = false;
  /** @type {import("cli-spinners").Spinner} */
  #spinner;
  #loadingText = "Loading...";
  #paused = false;
  constructor({ spinner = "arc" } = {}) {
    this.#currentLine = "";
    this.#commands = [];
    /** @type {boolean} */
    this.exit = false;
    this.#spinner = spinners[spinner];
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
        if (option.key.includes(" ")) throw Error("Key option's key can not include whitespace(\" \")!");
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

  show() {
    if (!this.#started) {
      if (!rl) rl = readline.createInterface({ input: process.stdin });
      this.#started = true;
      this.#patchInputs();
    }
  }

  pause() {
    this.#paused = true;
    this?.render?.();
  }

  resume() {
    this.#paused = false;
    this?.render?.();
  }

  set loadingText(v) {
    this.#loadingText = v?.toString?.() || this.loadingText;
  }

  get loadingText() {
    return this.#loadingText || "Loading...";
  }

  set delimiter(v) {
    this.#delimiter = v?.toString?.() || this.delimiter;
    this.render?.();
  }

  get delimiter() {
    return this.#delimiter || "~> ";
  }

  async #handle() {
    const input = this.#currentLine || "";

    if (input == "help") {
      this.#help();
      // return this.#handle();
      return;
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
    if (!command) { return await this.#callbacks.commandNotFound?.(); }
    const argStr = input.slice(commandName.length + 1).trim();
    const args = { argStr, parsedArgs: plsParseArgs(argStr), trigger: commandName, command };
    const validations = await quickMap(command.options,async (option) => {
      if (option.required) {
        if (typeof option.key == "string") {
          if (args.parsedArgs.get(option.key)) return true;
          else {
            await this.#callbacks.requiredOption?.(commandName, `--${option.key} ${option.name}`);
            return false;
          }
        } else {
          if (args.parsedArgs._[option.key]) return true;
          else {
            await this.#callbacks.requiredOption?.(commandName, `${option.key + 1}${shh[option.key + 1] || "th"} option`);
            return false;
          }
        }
      } else return true;
    });
    if (validations.every(x => x === true)) {
      this.#loading = true;
      let frame = 0;
      let framesLength = this.#spinner.frames.length;
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      let interval = setInterval(()=>{
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${this.#spinner.frames[frame = ((frame + 1) % (framesLength-1))]} ${this.#loadingText}`.trim());
      }, this.#spinner.interval);
      try {
        await command.onExecute(args);
      } catch (err) {
        clearInterval(interval);
        interval = null;
        console.log(err) 
      };
      if (interval) clearInterval(interval);
      this.#loading = false;
    }
    else await this.#callbacks.commandNotTriggered?.();
    // if (!this.exit) this.#handle();
  }
  /** @private */
  #callbacks = {
    commandNotFound() { console.error("[comqu] Command not found!") },
    requiredOption(cmdName, optName) { console.warn(`[comqu] Option "${optName}" is required for "${cmdName}"`) },
    commandNotTriggered() { console.error("[comqu] Command is not executed.") },
    render(delimiter, currentLine) { return `${delimiter}${currentLine}` },
    exit() { process.exit() }
  };

  /** @def {on(eventName: "render", callback: (delimiter: string, currentLine: string) => string | Promise<string>): void} */
  /** @def {on(eventName: "requiredOption", callback: (cmdName: string, optName: string) => void | Promise<void>): void} */
  /**
   * @param {"commandNotFound" | "requiredOption" | "commandNotTriggered"| "render" | "exit"} eventName 
   * @param {() => void | Promise<void>} callback 
   */
  on(eventName, callback) {
    this.#callbacks[eventName] = callback;
  }

  #patchInputs() {
    const self = this;
    
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    let lines = [];
    let lineIndex = 0;
    let cursorLocation = this.delimiter.length;
    process.stdin.on("data", /** @param {string} s */(s) => {
      if (this.#loading || this.#paused) return;
      switch (s) {
        case "\t": {
          let commandName;
          this.#commands.some(x => {
            let names = [x.name, ...(x.aliases ?? [])];
            return names.some(a => {
              if (a.startsWith(this.#currentLine) && a != this.#currentLine) {
                commandName = a;
                return true;
              }
            });
          });
          if (commandName) {
            this.#currentLine = commandName;
            cursorLocation = this.delimiter.length + this.#currentLine.length;
            render();
          };
          return;
        }
        case "\u001b[A": {
          let nLine = lines[lineIndex - 1];
          if (typeof nLine === "string") {
            let cache = this.#currentLine;
            if (lines.length == lineIndex) lines.push(cache);
            this.#currentLine = lines[--lineIndex];
            cursorLocation = this.delimiter.length + this.#currentLine.length;
            render();
          }
          return;
        }
        case "\u001b[B": {
          let nLine = lines[lineIndex + 1];
          if (typeof nLine === "string") {
            let cache = this.#currentLine;
            if (lines.length == lineIndex) lines.push(cache);
            this.#currentLine = lines[++lineIndex];
            cursorLocation = this.delimiter.length + this.#currentLine.length;
            render();
          }
          return;
        }
        case "\x08": {
          let cache = [...this.#currentLine];
          process.stdout.cursorTo(cursorLocation = Math.max(this.delimiter.length, cursorLocation - 1));
          cache.splice(cursorLocation - this.delimiter.length, 1);
          this.#currentLine = cache.join("");
          render();
          return;
        }
        case "\x03": {
          this.#callbacks.exit();
          return;
        };
        case "\x0d": {
          console.log(self.delimiter + this.#currentLine);
          this.#handle().then(() => {
            this.#currentLine = "";
            render();
            process.stdout.cursorTo(cursorLocation = this.delimiter.length);
          });
          lines.push(this.#currentLine);
          lines = lines.filter(x => x);
          lines.push('');
          lineIndex = lines.length - 1;
          return;
        }
        case "\x1b[D": {
          process.stdout.cursorTo(cursorLocation = Math.max(this.delimiter.length, cursorLocation - 1));
          return;
        }
        case "\x1b[C": {
          process.stdout.cursorTo(cursorLocation = Math.min(this.#currentLine.length + this.delimiter.length, cursorLocation + 1))
          return;
        }
      }
      
      
      {
        let cache = [...this.#currentLine];
        cache.splice(cursorLocation - this.#delimiter.length, 0, s);
        this.#currentLine = cache.join("");
      }
      cursorLocation += s.length;
      process.stdout.cursorTo(cursorLocation - 1);
      render();
    });

    function render() {
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      process.stdout.write(self.#callbacks.render(self.delimiter, self.#currentLine, self.#loading));
      process.stdout.cursorTo(cursorLocation);
    }
    this.render = render;
    render();
    ["log", "info", "warn", "error", "timeEnd", "table", "clear"].forEach((key) => {
      const _v = console[key];
      console[key] = function v(...args) {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        _v.call(this, ...args);
        render();
      }
    });

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
    if (typeof option.key == "string") return option.required ? `<--${option.key} ${option.name}>` : `[--${option.key} ${option.name}]`
    else return option.required ? `<${option.name}>` : `[${option.name}]`
  }

}
module.exports.CLI = CLI;