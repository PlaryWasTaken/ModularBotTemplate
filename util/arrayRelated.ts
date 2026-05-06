

export function arrayChunk<T>(array: Array<T>, size: number): T[][] {
    const chunkedArray = []
    for (let i = 0; i < array.length; i += size) {
        chunkedArray.push(array.slice(i, i + size))
    }
    return chunkedArray
}
export function chooseRandom<T>(array: Array<T>): T {
    if (array.length === 1) return array[0]
    return array[Math.floor(Math.random() * array.length)]
}