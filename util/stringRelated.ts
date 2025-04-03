import {array, boolean, number, object, optional, string} from "decoders";
import {InfiniteArray} from "./types";

export function generateDecoderForEmbedJSON() {
    return object({
        title: optional(string),
        description: optional(string),
        url: optional(string),
        timestamp: optional(string),
        color: optional(number),
        footer: optional(object({
            text: optional(string),
            icon_url: optional(string)
        })),
        image: optional(object({
            url: string
        })),
        thumbnail: optional(object({
            url: string
        })),
        author: optional(object({
            name: optional(string),
            url: optional(string),
            icon_url: optional(string)
        })),
        fields: optional(array(object({
            name: string,
            value: string,
            inline: optional(boolean)
        })))
    })
}

export function tryParseJSON(json: string): unknown {
    try {
        return JSON.parse(json)
    } catch {
        return undefined
    }
}

export function generateIndentation(values: InfiniteArray<string>, depth: number) {
    let newText = ""
    for (let i = 0; i < values.length; i++) {
        let line = values[i]
        if (typeof line === 'string') {
            if (depth > 0 && values[i + 1] instanceof Array) line = `┣┳ ${line}`
            else if (depth > 0 && values.length - 1 !== i ) line = `┣━ ${line}`
            else if (depth > 0) line = `┗━ ${line}`

            newText += `${"┃".repeat(Math.max(depth - 1, 0))}${line}\n`
        } else {
            newText += generateIndentation(line, depth + 1)
        }
    }
    return newText
}
export function genRandomHexId(): string {
    return Math.floor(Math.random() * 16777215).toString(16);
}