// noinspection JSUnusedGlobalSymbols

import {AnyView} from "../../types";
import {
    ActionRowBuilder,
    BaseMessageOptions,
    ButtonBuilder, ButtonInteraction,
    ButtonStyle
} from "discord.js";
import {EventEmitter} from "events";
import {Awaitable} from "@discordjs/util";

export type Page = BaseMessageOptions & { hasControls?: boolean }

export enum PaginatorFlags {
    Wrap = 1 << 0,
    AutoInit = 1 << 1,
    RemoveSelect = 1 << 2,
    RemovePrevious = 1 << 3,
    RemoveNext = 1 << 4,
}
export type PageUpdateFn = (page: Page) => Awaitable<Page>
export type ControlStyle = Partial<{
    previousButton: ButtonBuilder,
    nextButton: ButtonBuilder,
    selectButton: ButtonBuilder
}>
// type DeepWriteable<T> = { -readonly [P in keyof T]: DeepWriteable<T[P]> };        // Unused
export async function createPaginator(view: AnyView, pages: Page[], flags?: PaginatorFlags[], controlStyle?: ControlStyle) {
    const paginator = new PaginatorComponent(view, pages, flags, undefined, controlStyle);
    if (flags?.includes(PaginatorFlags.AutoInit)) await paginator.init();
    return paginator;
}
class PaginatorComponent extends EventEmitter {
    public currentPage: number;
    public totalPages: number;
    public view: AnyView;
    public pages: Page[];
    public readonly flags: PaginatorFlags[];
    private buttons: [ButtonBuilder, ButtonBuilder, ButtonBuilder] = [
        new ButtonBuilder()
            .setLabel("Anterior")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel("Selecionar")
            .setEmoji("🔍")
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setLabel("Próximo")
            .setStyle(ButtonStyle.Primary)
    ]
    private pageUpdate?: PageUpdateFn;

    constructor(view: AnyView, pages: Page[], flags?: PaginatorFlags[], pageUpdate?: PageUpdateFn, controlStyle?: ControlStyle) {
        super();
        this.view = view;
        this.totalPages = pages.length;
        this.pages = pages;
        this.flags = flags ?? [PaginatorFlags.Wrap];
        this.currentPage = 0;
        if (controlStyle) {
            if (controlStyle.previousButton) this.buttons[0] = controlStyle.previousButton;
            if (controlStyle.selectButton) this.buttons[1] = controlStyle.selectButton;
            if (controlStyle.nextButton) this.buttons[2] = controlStyle.nextButton;
        }
        this.view.on('nextPage', this.nextPageInteraction);
        this.view.on('previousPage', this.previousPageInteraction);
    }
    private addPaginationControls(page: Page) {
        if (page.hasControls) return page;
        page.hasControls = true;
        const components = page.components ?? []

        if (!this.flags.includes(PaginatorFlags.RemovePrevious)) this.buttons[0].setCustomId('previousPage');
        if (!this.flags.includes(PaginatorFlags.RemoveSelect)) this.buttons[1].setCustomId('selectPage');
        if (!this.flags.includes(PaginatorFlags.RemoveNext)) this.buttons[2].setCustomId('nextPage');
        const row = new ActionRowBuilder<any>()
            .setComponents(this.buttons);
        // @ts-ignore
        components.push(row)
        // @ts-ignore
        page.components = components;
        return page
    }
    private async updateView(page: number) {
        const pageData = this.pageUpdate ? await this.pageUpdate(this.pages[page]) : this.pages[page];
        await this.view.update(this.addPaginationControls(pageData))
    }
    private async nextPageInteraction(interaction: ButtonInteraction) {
        if (this.currentPage + 1 < this.totalPages) {
            this.currentPage++;
            await interaction.deferUpdate()
            await this.updateView(this.currentPage);
        } else if (this.flags.includes(PaginatorFlags.Wrap)) {
            this.currentPage = 0;
            await interaction.deferUpdate()
            await this.updateView(this.currentPage);
        } else {
            await interaction.reply({content: "Você está na última página", ephemeral: true})
        }
    }
    private async previousPageInteraction(interaction: ButtonInteraction) {
        if (this.currentPage - 1 > 0) {
            this.currentPage--;
            await interaction.deferUpdate()
            await this.updateView(this.currentPage);
        } else if (this.flags.includes(PaginatorFlags.Wrap)) {
            this.currentPage = this.totalPages - 1;
            await interaction.deferUpdate()
            await this.updateView(this.currentPage);
        } else {
            await interaction.reply({content: "Você está na primeira página", ephemeral: true})
        }
    }
    public setUpdateFunction(fn: PageUpdateFn) {
        this.pageUpdate = fn;
        return this;
    }
    public async alterPage(page: number, newPage: Page) {
        if (page < 0 || page >= this.totalPages) return;
        this.pages[page] = newPage;
        if (this.currentPage === page) await this.updateView(page);
    }
    public async nextPage() {
        if (this.currentPage + 1 < this.totalPages) {
            this.currentPage++;
            await this.updateView(this.currentPage);
        }
    }
    public async init() {
        await this.updateView(this.currentPage);
        this.view.refreshTimeout();
    }
    public async previousPage() {
        if (this.currentPage - 1 >= 0) {
            this.currentPage--;
            await this.updateView(this.currentPage);
        }
    }
    public async setPage(page: number) {
        if (page < 0 || page >= this.totalPages) return;
        this.currentPage = page;
        await this.updateView(this.currentPage);
    }
}