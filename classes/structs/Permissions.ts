import {OverrideNode, PermissionOverrideTree} from "../../types";
import {Logger} from "winston";
import {ActiveResolverIds, ResolverConfigStore} from "../../util/PermissionCompilation";


export function isEndNode(node: OverrideNode | PermissionOverrideTree): node is OverrideNode {
    return !(node instanceof Map)
}

function extractActiveIds(
    permissions: PermissionOverrideTree,
    resolverConfigs: ResolverConfigStore
): ActiveResolverIds {
    const ids: ActiveResolverIds = new Set()

    function recurse(node: PermissionOverrideTree) {
        for (const [, value] of node) {
            if (isEndNode(value)) {
                value.allow.forEach(id => ids.add(id))
                value.deny.forEach(id => ids.add(id))
            } else {
                recurse(value)
            }
        }
    }

    recurse(permissions)
    for (const id of resolverConfigs.keys()) ids.add(id)

    return ids
}

export class Permissions {
    private logger: Logger;
    public permissions: PermissionOverrideTree
    public resolverConfigs: ResolverConfigStore
    public activeIds: ActiveResolverIds

    constructor(
        logger: Logger,
        permissions: PermissionOverrideTree,
        resolverConfigs: ResolverConfigStore = new Map()
    ) {
        this.logger = logger;
        this.permissions = permissions;
        this.resolverConfigs = resolverConfigs
        this.activeIds = extractActiveIds(this.permissions, this.resolverConfigs)
    }
    set(permission: string, result: {
        allow: string[],
        deny: string[]
    }) {
        const namespaces = permission.split('.')
        let current = this.permissions
        const last = namespaces.pop()
        if (!last) {
            this.logger.warn(`No namespaces provided`)
            return
        }
        for (const namespace of namespaces) { // Builds the tree
            if (!current.get(namespace)) {
                current.set(namespace, new Map())
            }
            current = current.get(namespace) as PermissionOverrideTree
        }
        current.set(last, { // Sets the permission
            allow: result.allow,
            deny: result.deny
        })

    }
    get(permission: string, strict: boolean = false) {
        const namespaces = permission.split('.')
        let current = this.permissions
        let lastGlobal: OverrideNode | undefined = undefined
        for (const namespace of namespaces) {
            if (!current) {
                return lastGlobal // No global permission set for that namespace scope
            }
            if (isEndNode(current)) {
                return undefined // Reached the end of the tree prematurely
            }
            if (!current.get(namespace)) {
                if (current.get('*')) {
                    lastGlobal = current.get('*') as OverrideNode
                } else {
                    return undefined
                }
            }
            current = current.get(namespace) as PermissionOverrideTree
        }
        const finalTest = current as PermissionOverrideTree | OverrideNode | undefined
        if (!finalTest && strict) {
            return undefined
        }
        if (!finalTest) {
            return lastGlobal // No specific permission set, so it uses the closest global one
        }
        if (isEndNode(finalTest)) {
            return current // Has specific permission set, so it overrides the global one
        } else {
            return lastGlobal // No global permission set for that namespace scope
        }
    }
    getEndNode(permission: string, strict?: boolean) {
        const node = this.get(permission, strict)
        if (!node) return undefined
        if (isEndNode(node)) return node
        return undefined
    }
     getOrCreatePath(permission: string) {
        const namespaces = permission.split('.')
        let current = this.permissions
        for (const namespace of namespaces) {
            if (!current.get(namespace)) {
                current.set(namespace, new Map())
            }
            current = current.get(namespace) as PermissionOverrideTree
        }
        return current
     }

}