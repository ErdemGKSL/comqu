export type Option = {
    name: string;
    required: boolean;
    key?: string;
};
export type Command = {
    name: string;
    description: string;
    aliases: string[];
    options: Option[];
    onExecute: (args: {
        command: Command;
        trigger: string;
        argStr: string;
        parsedArgs: import("plsargs/dist/Result").Result;
    }) => Promise<void>;
};
type CommandGroupMap = { [k: string]: CommandGroupMap | Command };
export class CLI {
    constructor(args: { spinner: import("cli-spinners").SpinnerName }): CLI;
    exit: boolean;
    command(cmd: Command): CLI;
    commandGroups: CommandGroupMap;
    commands: {
        name: string;
        description: string;
        aliases: string[];
        options: Option[];
        onExecute: (args: {
            command: Command;
            trigger: string;
            argStr: string;
            parsedArgs: import("plsargs/dist/Result").Result;
        }) => Promise<void>;
    }[];
    show(): void;
    delimiter: string;
    loadingText: string;
    fetchCommandGroups(): CommandGroupMap;
    on(eventName: "render", callback: (delimiter: string, currentLine: string) => string): void
    on(eventName: "requiredOption", callback: (cmdName: string, optName: string) => void | Promise<void>): void
    on(eventName: "commandNotFound" | "requiredOption" | "commandNotTriggered" | "render" | "exit", callback: () => void | Promise<void>): void;
    #private;
}
