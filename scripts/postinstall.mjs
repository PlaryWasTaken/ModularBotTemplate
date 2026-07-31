import fs from 'fs-extra';
import path from 'path';

const NODE_MODULES = path.join(".", 'node_modules');
const MODULES_DIR = path.join(".", 'modules');
const SCOPES = ['@plarywastaken']; // Define the scopes to handle
function ensureLowerCaseFolderName(folder, parentDir) {
    const folderName = folder.toLowerCase();

    console.log(`Searching for folder ${folderName}`);
    const matchedFolder = fs.readdirSync(parentDir).find(
        f => f.toLowerCase() === folderName
    );

    if (matchedFolder) {
        if (matchedFolder === folderName) {
            console.log(`Found match that is already lowercase`);
            return path.join(parentDir, matchedFolder);
        }
        console.log(`Found ${folderName} with name: ${matchedFolder}`);

        fs.renameSync(path.join(parentDir, matchedFolder), path.join(parentDir, folderName));
        return path.join(parentDir, folderName)
    }

    console.log(`No matching folder found for ${folder}`);
    return [];
}
function ensureNoDuplicatesWithDifferentCase(modulesPath) {
    const dirContent = fs.readdirSync(modulesPath);

    // Create a map to track lowercase folder names
    //const seenFolders = new Map();

    for (const folder of dirContent) {
        const lowerCaseName = folder.toLowerCase();
        if (lowerCaseName !== folder) { // Not lowercase
            console.log(`Found a folder with non-lowercase ${folder}, deleting`);
            fs.removeSync(path.join(modulesPath, lowerCaseName));
        } else {
            console.log(`Found a folder with proper lowercase ${folder}`);
        }
        /*
        if (seenFolders.has(lowerCaseName)) {
            const original = seenFolders.get(lowerCaseName);
            console.log(`Found duplicate: "${folder}" (keeping "${original}")`);
            fs.removeSync(path.join(modulesPath, folder));
        } else {
            seenFolders.set(lowerCaseName, folder);
        }
        Cool ideia, doenst work with the docker build step
         */
    }
    console.log(`Finished searching for duplicates`);
}
function moveScopedModules() {
    SCOPES.forEach((scope) => {
        const scopeDir = path.join(NODE_MODULES, scope);

        if (fs.existsSync(scopeDir)) {
            const scopedModules = fs.readdirSync(scopeDir);
            console.log(scopedModules);
            // Ensure destination directory exists
            fs.ensureDirSync(MODULES_DIR);
            //const currentModules = fs.readdirSync(MODULES_DIR);
            //const toLowerCaseModules = currentModules.map(s => s.toLowerCase());
            moduleLoop:
            for (const module of scopedModules) {
                const source = path.join(scopeDir, module);
                const destination = path.join(MODULES_DIR, module);

                
                try {
                    const rootPackage = fs.readJSONSync(path.join(source, "package.json"), {throws: false});
                    console.log(`${module} ${destination} ${rootPackage.version}`);
                    const destDir = fs.readdirSync(ensureLowerCaseFolderName(path.basename(destination), path.dirname(destination)));
                    console.log(destDir);
                    const forceUpdate = process.argv.includes("-f");
                    const forceDisabled = process.argv.includes("-d");
                    if (destDir.length > 0) {
                        for (const file of destDir) {
                            if (file === "manifest.json") {
                                const manifest = fs.readJSONSync(path.join(destination, file), {throws: false});
                                const packageJson = fs.readJSONSync(path.join(destination, "package.json"), {throws: false});
                                console.log(`Manifest module name: ${manifest.name}`);
                                console.log(`Package name: ${packageJson.name}`);
                                if (manifest && manifest.disabled === true && !forceDisabled) {
                                    console.log(`Module ${module} is disabled, skipping`);
                                    continue moduleLoop
                                }
                                if (packageJson && packageJson.version ===  rootPackage.version && !forceUpdate) {
                                    console.log(`Module ${module} is up to date, skipping`);
                                    continue moduleLoop
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(e);
                    console.log(`Couldn't find module ${module} in destination, copying`);
                }



                // Move the module's source code to the modules directory
                console.log(`Moving ${scope}/${module} to ${destination}`);
                fs.removeSync(destination); // Clean up old version
                fs.copySync(source, destination); // Copy new version
            }
        }
    });
}
moveScopedModules();
//ensureNoDuplicatesWithDifferentCase(MODULES_DIR);
