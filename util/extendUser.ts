import {UserModule} from "./classes/UserModule";
import User from "../classes/structs/User";


const userModuleCache = new WeakMap<
    User,
    Map<string, UserModule>
>()

export function extendUser<
    T extends UserModule
>(
    moduleName: string,
    ModuleClass: new (user: User) => T
) {
    Object.defineProperty(User.prototype, moduleName, {
        get(this: User): T {
            let modules = userModuleCache.get(this)
            if (!modules) {
                modules = new Map()
                userModuleCache.set(this, modules)
            }

            let instance = modules.get(moduleName) as T | undefined
            if (!instance) {
                instance = new ModuleClass(this)
                modules.set(moduleName, instance)
            }

            return instance
        },
        enumerable: true,
        configurable: true,
    })
}
