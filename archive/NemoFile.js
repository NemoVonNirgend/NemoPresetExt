// NemoFile.js

class NemoFile {
    constructor(name, type = 'file', children = []) {
        this.name = name;
        this.type = type; // 'file' or 'folder'
        this.children = children;
        this.id = `nemo-file-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    static fromJSON(json) {
        const file = new NemoFile(json.name, json.type);
        file.id = json.id;
        if (json.children) {
            file.children = json.children.map(childJson => NemoFile.fromJSON(childJson));
        }
        return file;
    }

    toJSON() {
        return {
            id: this.id,
            name: this.name,
            type: this.type,
            children: this.children.map(child => child.toJSON()),
        };
    }
}

export default NemoFile;