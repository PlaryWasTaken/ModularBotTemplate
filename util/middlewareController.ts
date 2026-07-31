
type TransformerMiddlewareFn<T, K> = (value: T) => K | Promise<K>;
type MiddlewareFn<T> = (value: T) => void | Promise<void>;
export class TransformerMiddleware<T, K extends T> {
    private readonly middlewares = new Map<string, TransformerMiddlewareFn<T, K>>();

    /**
     * Add a middleware function.
     * Returns an id that can be used to remove it later.
     */
    push(fn: TransformerMiddlewareFn<T, K>): string {
        const id = crypto.randomUUID();
        this.middlewares.set(id, fn);
        return id;
    }

    /** Remove middleware by id */
    remove(id: string): boolean {
        return this.middlewares.delete(id);
    }

    /** Execute all middleware in order */
    async run(value: T): Promise<K> {
        let runningValue = value
        for (const fn of this.middlewares.values()) {
            runningValue = await fn(runningValue);
        }
        return runningValue as K
    }

    /** Clear all middleware */
    clear(): void {
        this.middlewares.clear();
    }
}

export class Middleware<T> {
    private readonly middlewares = new Map<string, MiddlewareFn<T>>();

    /**
     * Add a middleware function.
     * Returns an id that can be used to remove it later.
     */
    push(fn: MiddlewareFn<T>): string {
        const id = crypto.randomUUID();
        this.middlewares.set(id, fn);
        return id;
    }

    /** Remove a middleware by id */
    remove(id: string): boolean {
        return this.middlewares.delete(id);
    }

    /** Execute all middleware in order */
    async run(value: T): Promise<void> {
        for (const fn of this.middlewares.values()) {
            await fn(value);
        }
    }

    /** Clear all middleware */
    clear(): void {
        this.middlewares.clear();
    }
}