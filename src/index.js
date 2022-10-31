const readline = require("readline");
const { plsParseArgs } = require("plsargs");
const { quickMap } = require("async-and-quick");
const spinners = require("cli-spinners");
const _ = require("lodash");
const { debounce } = require("lodash");
/** @type {readline.Interface} */
let rl;

const shh = [, , "nd", "rd"];
/** @typedef {{ name: string, required: boolean, key?: string }} Option */
/** @typedef {{ name: string, description: string, aliases: string[], options: Option[], onExecute: (args: { command: Command, trigger: string, argStr: string, parsedArgs: import("plsargs/dist/Result").Result }) => Promise<void>}} Command */
class CLI {
  static COMQU_PREFIX = "[comqu]";
  #delimiter = "~> ";
  /** @type {Command[]} */
  #commands;
  #started = false;
  /** @type {string} */
  #currentLine;
  commandHistory = [];
  #loading = false;
  /** @type {import("cli-spinners").Spinner} */
  #spinner;
  #loadingText = "Loading...";
  #paused = false;
  #maxHistorySize;

  constructor({ spinner = "dots", maxHistorySize = 128 } = {}) {
    this.#maxHistorySize = maxHistorySize;
    this.#currentLine = "";
    this.#commands = [];
    /** @type {boolean} */
    this.exit = false;
    this.#spinner = spinners[spinner];
    this.commandGroups = {};
    this.fetchCommandGroups = debounce(() => { let x = this.#formatCommandGroups(); this.commandGroups = x; return x; }, 100);
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
    this.fetchCommandGroups();
    return this;
  }

  get commands() {
    return this.#commands.map(x => ({ ...x }));
  }

  #formatCommandGroups(commands = this.commands, indexToFormat = 0) {
    const sizeMap = {};
    const commandGroups = {};
    commands.forEach((cmd) => {
      const sizeIndex = cmd.name.split(" ")[indexToFormat];
      if (!sizeMap[sizeIndex]) sizeMap[sizeIndex] = 1;
      else sizeMap[sizeIndex] = 1 + sizeMap[sizeIndex];
    });
    for (let groupName in sizeMap) {
      if (groupName == 'undefined') commandGroups['_default'] = commands.find(i => !i.name.split(" ")[indexToFormat]);
      else if (sizeMap[groupName] === 1) commandGroups[groupName] = commands.find(i => i.name.split(" ")[indexToFormat] == groupName);
      else commandGroups[groupName] = this.#formatCommandGroups(commands.filter(i => i.name.split(" ")[indexToFormat] == groupName), indexToFormat + 1);
    }
    return commandGroups;
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

    if (input.startsWith("help")) {
      let x = input.slice(5).trim();
      this.#help(x);
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
    const validations = await quickMap(command.options, async (option) => {
      if (option.required) {
        if (args.parsedArgs.has(option.key)) return true;
        else return await this.#callbacks.requiredOption?.(commandName, `--${option.key} ${option.name}`), false;
        // if (typeof option.key == "string") {
        //   if (args.parsedArgs.get(option.key)) return true;
        //   else {
        //     await this.#callbacks.requiredOption?.(commandName, `--${option.key} ${option.name}`);
        //     return false;
        //   }
        // } else {
        //   if (args.parsedArgs._[option.key]) return true;
        //   else {
        //     await this.#callbacks.requiredOption?.(commandName, `${option.key + 1}${shh[option.key + 1] || "th"} option`);
        //     return false;
        //   }
        // }
      } else return true;
    });
    if (validations.every(x => x === true)) {
      this.#loading = true;
      let frame = 0;
      let framesLength = this.#spinner.frames.length;
      process.stdout.clearLine();
      process.stdout.cursorTo(0);
      let interval = setInterval(() => {
        process.stdout.clearLine();
        process.stdout.cursorTo(0);
        process.stdout.write(`${this.#spinner.frames[frame = ((frame + 1) % (framesLength - 1))]} ${this.#loadingText}`.trim());
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
    } else await this.#callbacks.commandNotTriggered?.();
    // if (!this.exit) this.#handle();
  }
  /** @private */
  #callbacks = {
    commandNotFound() { console.error(CLI.COMQU_PREFIX + " \x1b[36mCommand not found!\x1b[0m") },
    requiredOption(cmdName, optName) { console.warn(CLI.COMQU_PREFIX + ` \x1b[36mOption "${optName}" is required for "${cmdName}"\x1b[0m`) },
    commandNotTriggered() { console.error(CLI.COMQU_PREFIX + " \x1b[36mCommand is not executed.\x1b[0m") },
    render(delimiter, currentLine) { return `${delimiter}${currentLine}` },
    exit() { setTimeout(process.exit, 0); return "Exited!"; },
    triggerLog(delimiter, currentLine) { return `${color(delimiter, 90)}${color(currentLine, 36)}` }
  };

  /** @def {on(eventName: "render", callback: (delimiter: string, currentLine: string) => string | Promise<string>): void} */
  /** @def {on(eventName: "requiredOption", callback: (cmdName: string, optName: string) => void | Promise<void>): void} */
  /**
   * @param {"commandNotFound" | "requiredOption" | "commandNotTriggered"| "render" | "exit" | "triggerLog"} eventName 
   * @param {() => void | Promise<void>} callback 
   */
  on(eventName, callback) {
    this.#callbacks[eventName] = callback;
  }

  #patchInputs() {
    const self = this;

    function clampHistorySize() {
      if (self.#maxHistorySize <= self.commandHistory.length) self.commandHistory.splice(0, self.commandHistory.length - self.#maxHistorySize)
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding("utf-8");
    // let this.commandHistory = [];
    let lineIndex = 0;
    let cursorLocation = this.delimiter.length;
    let lastTab = "";
    let tabbed = false;
    process.stdin.on("data", /** @param {string} s */(s) => {
      if (this.#loading || this.#paused) return;
      switch (s) {
        case "\t": {
          if (!tabbed) lastTab = this.#currentLine;
          let commandName;
          let lastTabFound = false;

          this.#commands.some(x => {
            let names = [x.name, ...(x.aliases ?? [])];
            return names.some(a => {
              if (a.startsWith(lastTab)) {
                if (!lastTabFound && tabbed && this.#currentLine == a) {
                  lastTabFound = true;
                  return false;
                }
                if (!lastTabFound && this.#currentLine && tabbed) return false;
                if (this.#currentLine == a) return false;
                commandName = a;
                return true;
              }
            });
          });

          if (!commandName && lastTabFound) this.#commands.some(x => {
            let names = [x.name, ...(x.aliases ?? [])];
            return names.some(a => {
              if (a.startsWith(lastTab) && this.#currentLine != a) {
                commandName = a;
                return true;
              }
            });
          });
          if (commandName) {
            console.log("0")
            this.#currentLine = commandName;
            cursorLocation = this.delimiter.length + (this.#currentLine.length || 0);
            render();
          } else {
            const input = this.#currentLine;
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
            const cmplt = command?.onComplete?.({ commandName ,argStr: input.replace(commandName).trim()});
            this.#currentLine = commandName + " " + cmplt;
          }
          tabbed = true;
          return;
        }
        case "\u001b[A": {
          let nLine = this.commandHistory[lineIndex - 1];
          if (typeof nLine === "string") {
            // let cache = this.#currentLine;
            // if (this.commandHistory.length == lineIndex) { this.commandHistory.push(cache); clampHistorySize(); }
            this.#currentLine = this.commandHistory[--lineIndex];
            cursorLocation = this.delimiter.length + this.#currentLine.length;
            render();
          }
          return;
        }
        case "\u001b[B": {
          let nLine = this.commandHistory[lineIndex + 1];
          if (typeof nLine === "string") {
            // let cache = this.#currentLine;
            // if (this.commandHistory.length == lineIndex) {this.commandHistory.push(cache); clampHistorySize(); }
            this.#currentLine = this.commandHistory[++lineIndex];
            cursorLocation = this.delimiter.length + this.#currentLine.length;
            render();
          }
          return;
        }
        case "\x08": {
          tabbed = false;
          lastTab = "";
          let cache = [...this.#currentLine];
          process.stdout.cursorTo(cursorLocation = Math.max(this.delimiter.length, cursorLocation - 1));
          cache.splice(cursorLocation - this.delimiter.length, 1);
          this.#currentLine = cache.join("");
          render();
          return;
        }
        case "\x03": {
          process.stdout.cursorTo(0);
          process.stdout.clearLine();
          process.stdout.write(this.#callbacks.exit());
          return;
        };
        case "\x0d": {
          console.log(this.#callbacks.triggerLog(this.delimiter, this.#currentLine));
          this.#handle().then(() => {
            this.#currentLine = "";
            cursorLocation = this.delimiter.length
            render();
            // process.stdout.cursorTo();
          });
          this.commandHistory.push(this.#currentLine.replaceAll("\u001b[2K", ""));
          clampHistorySize();
          this.commandHistory = this.commandHistory.filter(x => x);
          this.commandHistory.push('');
          lineIndex = this.commandHistory.length - 1;
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

      tabbed = false;
      lastTab = "";
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

  #help(commandName = "") {
    let t = `  ${color("comqu commands:", 4)}\n\n`;
    let cmdsAndGroupsToPrint = _.get(this.commandGroups, commandName.split(" ").filter(x => x).map((v) => `["${v}"]`).join(""), this.commandGroups);
    if (typeof cmdsAndGroupsToPrint.onExecute == "function") cmdsAndGroupsToPrint = { [cmdsAndGroupsToPrint.name]: cmdsAndGroupsToPrint };
    let strArr = [];
    Object.entries(cmdsAndGroupsToPrint).sort((a, b) => typeof a.onExecute == "function" ? 0 : 1).forEach(([groupName, item]) => {
      if (typeof item.onExecute != "function") {
        strArr.push([
          `  ${color("$$", 90)} ${color(`${groupName} ...`, 36)}`,
          color(`command group (has ${Object.keys(item).filter(i => i != "_default").length} sub-commands)`, 90)
        ]);
      } else {
        strArr.push([
          `  ${color("$", 90)} ${color(`${commandName}${groupName == "_default" ? "" : ` ${groupName}`} ${item.options?.map(this.#optionToString)?.join(" ")}`, 36)}`,
          color(item.description || "", 90)
        ]);
      }
    });
    let maxLength = Math.max(...strArr.map(i => i[0].length), 35);
    t += strArr.map(i => `${i[0].padEnd(maxLength)}  ${i[1]}`).join("\n");
    console.log(t);
    return t;
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
function color(str, ...c) {
  return `${c.map(i => `\x1b[${i}m`).join("")}${str}\x1b[0m`;
}