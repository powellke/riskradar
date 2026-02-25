import AdmZip from 'adm-zip';
import path from 'path';
import { parsePackageJson } from './packageJsonParser';
import { ScanTarget } from './types';
import fs from 'fs';
import os from 'os';

export function parseZip(filePath: string): ScanTarget[] {
    const targets: ScanTarget[] = [];
    try {
        const zip = new AdmZip(filePath);
        const zipEntries = zip.getEntries();

        // Create a temporary directory to extract package.json files
        const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'riskradar-'));

        zipEntries.forEach(entry => {
            // Look for files named exactly package.json or ending in /package.json
            if (entry.name === 'package.json') {
                const destPath = path.join(tmpDir, entry.entryName);
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.writeFileSync(destPath, entry.getData());

                // Parse the extracted package.json
                const target = parsePackageJson(destPath);
                // Override the filepath visually to be relative to the zip
                target.filePath = `${path.basename(filePath)}::${entry.entryName}`;
                targets.push(target);
            }
        });

        // Cleanup (optional but good practice, keeping simple for now)
        return targets;
    } catch (error: any) {
        throw new Error(`Failed to parse Zip at ${filePath}: ${error.message}`);
    }
}
