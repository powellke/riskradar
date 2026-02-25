import { PackageDefinition } from '../parsers/types';

export interface OsvVulnerability {
    id: string;
    summary: string;
    details: string;
    modified: string;
    published: string;
    database_specific?: {
        severity?: string;
    };
    references?: { type: string; url: string }[];
}

export interface OsvResult {
    vulns?: OsvVulnerability[];
}

export async function runOsvScan(packages: PackageDefinition[]): Promise<Map<string, OsvVulnerability[]>> {
    const resultsMap = new Map<string, OsvVulnerability[]>();
    if (packages.length === 0) return resultsMap;

    const BATCH_SIZE = 100;

    for (let i = 0; i < packages.length; i += BATCH_SIZE) {
        const batch = packages.slice(i, i + BATCH_SIZE);

        const queries = batch.map(pkg => ({
            package: { name: pkg.name, ecosystem: 'npm' },
            version: pkg.version === 'latest' ? undefined : pkg.version
        }));

        try {
            const response = await fetch('https://api.osv.dev/v1/querybatch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ queries })
            });

            if (!response.ok) {
                throw new Error(`OSV API HTTP error: ${response.status}`);
            }

            const data = await response.json() as { results: OsvResult[] };

            data.results?.forEach((result, index) => {
                const pkgName = batch[index].name;
                if (result.vulns && result.vulns.length > 0) {
                    const current = resultsMap.get(pkgName) || [];
                    resultsMap.set(pkgName, [...current, ...result.vulns]);
                }
            });
        } catch (error: any) {
            console.warn(`[Warning] Failed to query OSV API for batch: ${error.message}`);
        }
    }

    return resultsMap;
}
