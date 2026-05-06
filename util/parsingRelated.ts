import {RecursiveMap} from "../types";


export function parseToDatabase<T>(map: RecursiveMap<T>): [string, T][] {
    const built = [] as [string, T][]
    for (const [key, value] of map.entries()) {
        // @ts-ignore
        if (value instanceof Map) built.push([key, parseToDatabase(value)])
        else built.push([key, value])
    }
    return built
}

export function parseFromDatabase<T>(array: [string, T][]): RecursiveMap<T> {
    const built = new Map()
    for (const [key, value] of array) {
        if (value instanceof Array) built.set(key, parseFromDatabase(value))
        else built.set(key, value)
    }
    return built
}
export function stripUserMention(args: string[]) {
    if (!args.length) return args
    if (/^<@!?\d+>$/.test(args[0])) {
        args.shift()
    }
    return args
}
export function isolateDuplicates<T>(array: T[], key?: keyof T): T[] {
    if (!key) {
        return array.filter((x, index) => array.findIndex((y, index2) => x === y && index !== index2) !== -1)
    } else {
        return array.filter((x, index) => array.findIndex((y, index2) => x[key] === y[key] && index !== index2) !== -1)
    }
}