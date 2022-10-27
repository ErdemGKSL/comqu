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
export class CLI {
    exit: boolean;
    command(cmd: Command): CLI;
    get commands(): {
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
    init(): void;
    set delimiter(arg: any);
    get delimiter(): any;
    on(eventName: "render", callback: (delimiter: string, currentLine: string) => string): void
    on(eventName: "requiredOption", callback: (cmdName: string, optName: string) => void | Promise<void>): void
    on(eventName: "commandNotFound" | "requiredOption" | "commandNotTriggered" | "render", callback: () => void | Promise<void>): void;
    #private;
}
