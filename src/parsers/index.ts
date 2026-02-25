import { parseCsv } from './csvParser';
import { parsePackageJson } from './packageJsonParser';
import { parseZip } from './zipParser';
import { ScanTarget } from './types';
import path from 'path';

export async function parseInputFile(filePath: string): Promise<ScanTarget[]> {
    const ext = path.extname(filePath).toLowerCase();

    switch (ext) {
        case '.json':
            return [parsePackageJson(filePath)];
        case '.csv':
            return [await parseCsv(filePath)];
        case '.zip':
            return parseZip(filePath);
        default:
            throw new Error(`Unsupported file type: ${ext}`);
    }
}
