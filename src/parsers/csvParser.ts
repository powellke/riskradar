import fs from 'fs';
import csvParser from 'csv-parser';
import path from 'path';
import { PackageDefinition, ScanTarget } from './types';

export function parseCsv(filePath: string): Promise<ScanTarget> {
    return new Promise((resolve, reject) => {
        const packages: PackageDefinition[] = [];
        let rowNum = 1;

        fs.createReadStream(filePath)
            .pipe(csvParser())
            .on('data', (row: any) => {
                rowNum++;
                // Try to find a column that looks like package name.
                // E.g., 'Package Name', 'name', 'package'.
                const nameKey = Object.keys(row).find(k => k.toLowerCase().includes('name') || k.toLowerCase().includes('package'));
                // Try to find version
                const versionKey = Object.keys(row).find(k => k.toLowerCase().includes('version'));

                if (nameKey && row[nameKey]) {
                    packages.push({
                        name: row[nameKey].trim(),
                        version: (versionKey && row[versionKey]) ? row[versionKey].trim() : 'latest',
                        source: `Row ${rowNum}`,
                    });
                }
            })
            .on('end', () => {
                resolve({
                    targetName: path.basename(filePath),
                    filePath: filePath,
                    packages
                });
            })
            .on('error', (err: any) => {
                reject(new Error(`Failed to parse CSV at ${filePath}: ${err.message}`));
            });
    });
}
