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
    start(): void;
    set delimiter(arg: any);
    get delimiter(): any;
    responses: {
        commandNotFound(): void;
        requiredOption(cmdName: any, optName: any): void;
        commandNotTriggered(): void;
    };
    #private;
}
