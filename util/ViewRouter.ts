// noinspection JSUnusedGlobalSymbols

import {EventEmitter} from "events";
import {Logger} from "winston";
import {AnyView, MessageViewUpdate} from "../types";
import snowflakify from "snowflakify";
import {ActionRowBuilder} from "discord.js";
type Page = {
    style: MessageViewUpdate,
    id: string
}

function forwardEvents(forwarder: EventEmitter, forwarded: EventEmitter) {
    const forwarderEmit = forwarder.emit;

    forwarder.emit = function (eventName: string | symbol, ...args: any[]) {
        const fnArgs = [eventName, ...args] as [string | symbol, ...any[]];
        forwarded.emit.apply(forwarded, fnArgs);
        forwarderEmit.apply(forwarder, fnArgs);
        return true
    }
}

export class ViewRouter extends EventEmitter {
    private logger: Logger;
    public stack: Page[] = [];
    private readonly snowflaker: snowflakify;
    public view: AnyView;
    private forcedRows: ActionRowBuilder[] = [];
    public namedRoutes: Record<string, {
        viewFn: (context: Record<string, any>) => MessageViewUpdate,
    }> = {};
    constructor(logger: Logger, view: AnyView, baseRouteFn?: (context: Record<string, any>) => MessageViewUpdate) {
        super();
        this.logger = logger.child({
            service: 'ViewRouter',
            hexColor: '#a5ecec'
        })
        this.snowflaker = new snowflakify();
        this.view = view;
        forwardEvents(view, this);
        this.namedRoutes = {
            "/": { // Base named route
                viewFn: baseRouteFn ?? (() => view.latestUpdate)
            }
        }
        view.on("returnPage", async () => {
            await this.pop();
        })
    }
    public addNamedRoute(name: string, viewFn: (context: Record<string, any>) => MessageViewUpdate) {
        this.namedRoutes[name] = {viewFn}
    }
    //* Pushing a named route will remove all unnamed routes from the stack and push the named route on top */
    public async pushToNamed(route: string, context: Record<string, any>) {
        const routeData = this.namedRoutes[route];
        if (!routeData) {
            this.logger.error(`Route ${route} not found`);
            return;
        }
        const update = routeData.viewFn(context);
        this.clearStack();
        await this.push(update);
    }
    /*
    If i re-implement this, remember to delete the oldview or have a way to handle the forwarded events from it
    public setView(view: AnyView) {
        this.view = view;
        forwardEvents(view, this);
    }
     */
    public setRows(rows: ActionRowBuilder[]) {
        this.forcedRows = rows;
    }

    public async push(update: MessageViewUpdate) {
        const id = this.snowflaker.nextHexId();
        this.stack.push({style: update, id});
        this.view.setId(id);
        if (update.components) update.components = [...update.components, ...this.forcedRows as any];
        else update.components = this.forcedRows as any;

        await this.view.update(update);
        return id;
    }
    public async pop() {
        const page = this.stack.pop();
        if (!page) return;
        this.view.setId(page.id);
        await this.view.update(page.style);
        return page.id;
    }

    public clearStack() {
        this.stack = [];
    }


    public async update(update: MessageViewUpdate) {
        return this.view.update(update);
    }
    public async destroy() {
        this.view.destroy();
    }
}