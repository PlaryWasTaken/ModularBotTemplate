import * as fs from 'fs';
import * as path from 'path';
import {Logger} from "winston";
import {Module, Event, ExtendedClient} from "../types";

async function findJsFiles(dir: string, logger: Logger): Promise<Array<Event<any>>> {
    let results: Array<Event<any>> = [];
    const list = await fs.promises.readdir(dir);
    logger.info(`Found ${list.length} files in ${dir}`);
    for (const file of list) {
        const filePath = path.resolve(dir, file);
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
            logger.info(`Found directory ${file} in ${dir}`);
            results = results.concat(await findJsFiles(filePath, logger));
        } else if (path.extname(filePath) === '.ts') {
            logger.info(`Found event file ${filePath}`);
            const event = require(filePath)
            results.push(event.event);
        }
    }
    return results;
}


export default async (client: ExtendedClient, module: Module) => {
    if (module.name === 'Default') {
        const files = await findJsFiles(`./defaults/events`, module.logger.child({ service: 'Event Loader', hexColor: '#CCAAFF' }));
        for (const file of files) {
            module.logger.notice(`Loading event ${file.event} from Defaults`);
            client.on(file.event, file.func.bind(null, client, module.logger));
        }
        module.logger.notice(`Loaded ${files.length} events for module ${module.data.name}`);
    } else {
        const files = await findJsFiles(`./modules/${module.folderName}/${module.data.eventsFolder}`, module.logger.child({ service: 'Event Loader', hexColor: '#CCAAFF' }));
        for (const file of files) {
            module.logger.notice(`Loading event ${file.event} from module ${module.name}`);
            client.on(file.event, file.func.bind(null, client, module.logger));
        }
        module.logger.notice(`Loaded ${files.length} events for module ${module.data.name}`);
    }

}