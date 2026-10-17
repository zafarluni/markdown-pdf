import fs from 'node:fs/promises';
import path from 'node:path';
export async function markdownFiles(input, exclude = []) {
    const stat = await fs.stat(input);
    if (stat.isFile())
        return input.toLowerCase().endsWith('.md') ? [input] : [];
    const result = [];
    async function walk(directory) {
        for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
            if (exclude.some((part) => entry.name === part))
                continue;
            const full = path.join(directory, entry.name);
            if (entry.isDirectory())
                await walk(full);
            else if (entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
                result.push(full);
        }
    }
    await walk(input);
    return result.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
