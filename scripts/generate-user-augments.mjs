import fs from "fs";
import path from "path";

const modulesDir = path.resolve("./modules");
const outputFile = path.join(modulesDir, "types.d.ts");

const entries = fs.readdirSync(modulesDir, { withFileTypes: true });
const augments = [];

for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const augmentPath = path.join(modulesDir, entry.name, "declarations.ts");
    if (fs.existsSync(augmentPath)) {
        augments.push(`import "./${entry.name}/declarations";`);
    }
}

const content = `// This file is auto-generated. Do not edit manually.\n\n${augments.join(
    "\n"
)}\n`;

fs.writeFileSync(outputFile, content);
console.log(`[UserModule] Generated types.ts with ${augments.length} module(s).`);