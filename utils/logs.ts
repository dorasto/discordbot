function extractFileName(stackTrace: string): string | null {
    const callerLine = stackTrace.split("\n")[2]; // Assuming the caller is in the third line
    const fileNameMatch = callerLine.match(
        /\sat\s(?:.*\()?(.*[\/\\])([^\/\\]+):\d+:\d+\)?$/
    ); // Adjusted regex to capture only file name
    if (fileNameMatch) {
        return fileNameMatch[2];
    }
    return null;
}

export function log(message: any) {
    const stackTrace = new Error().stack;
    if (stackTrace) {
        const fileName = extractFileName(stackTrace);
        if (fileName) {
            console.log(`LOG: ${fileName} - ${message}`);
        }
    }
}

export function warn(message: any) {
    const stackTrace = new Error().stack;
    if (stackTrace) {
        const fileName = extractFileName(stackTrace);
        if (fileName) {
            console.warn(`\x1b[33mWARNING: ${fileName} - ${message}\x1b[0m`);
        }
    }
}

export function error(message: any) {
    const stackTrace = new Error().stack;
    if (stackTrace) {
        const fileName = extractFileName(stackTrace);
        if (fileName) {
            console.error(`\x1b[31mERROR: ${fileName} - ${message}\x1b[0m`);
        }
    }
}
const coloursList = {
    red: 31,
    green: 32,
    yellow: 33,
    blue: 34,
    magenta: 35,
    cyan: 36,
    white: 37,
};
export function colour(
    message: string,
    colour:
        | "red"
        | "green"
        | "yellow"
        | "blue"
        | "magenta"
        | "cyan"
        | "white"
        | number
) {
    if (typeof colour === "number") {
        console.log(`\x1b[${colour}m${message}\x1b[0m`);
        return;
    }
    const color: any = coloursList[colour] || 36;
    console.log(`\x1b[${color}m${message}\x1b[0m`);
}
