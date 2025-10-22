const fs = require("fs");
const path = require("path");

const root = process.cwd();

const importRegex = new RegExp("(import\\s+[^'\";]*?\\s+from\\s+)(['\"])(\\.{1,2}\/[^'\"\\n]+)\\2", "g");
const dynamicImportRegex = new RegExp("(import\\(\\s*)(['\"])(\\.{1,2}\/[^'\"\\n]+)\\2(\\s*\\))", "g");
const exportFromRegex = new RegExp("(export\\s+[^'\";]*?\\s+from\\s+)(['\"])(\\.{1,2}\/[^'\"\\n]+)\\2", "g");

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === "node_modules" || entry.name === ".git") {
            continue;
        }
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
            processFile(fullPath);
        }
    }
}

function adjustSpecifier(filePath, spec) {
    const dir = path.dirname(filePath);
    const resolved = path.resolve(dir, spec);
    if (fs.existsSync(resolved)) {
        return null;
    }

    const altSpec = path.posix.join("..", spec);
    const altResolved = path.resolve(dir, altSpec);
    if (fs.existsSync(altResolved)) {
        return altSpec;
    }

    return null;
}

function replaceMatches(content, regex, filePath) {
    return content.replace(regex, function(match, ...groups) {
        const spec = groups[2];
        const newSpec = adjustSpecifier(filePath, spec);
        if (!newSpec) {
            return match;
        }
        changed = true;
        return match.replace(spec, newSpec);
    });
}

let changedFiles = 0;

function processFile(filePath) {
    let content = fs.readFileSync(filePath, "utf8");
    changed = false;

    content = replaceMatches(content, importRegex, filePath);
    content = replaceMatches(content, exportFromRegex, filePath);
    content = replaceMatches(content, dynamicImportRegex, filePath);

    if (changed) {
        fs.writeFileSync(filePath, content, "utf8");
        changedFiles++;
        console.log(`Updated imports in ${path.relative(root, filePath)}`);
    }
}

let changed = false;
walk(root);
console.log(`Finished. Updated ${changedFiles} file(s).`);
