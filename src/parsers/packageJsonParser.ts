import fs from 'fs';
import { PackageDefinition, ScanTarget } from './types';
import path from 'path';

export function parsePackageJson(filePath: string): ScanTarget {
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const pkg = JSON.parse(fileContent);
        const packages: PackageDefinition[] = [];

        const addDependencies = (deps: Record<string, string> | undefined, type: string) => {
            if (!deps) return;
            for (const [name, version] of Object.entries(deps)) {
                packages.push({
                    name,
                    version,
                    source: `${type}`,
                });
            }
        };

        addDependencies(pkg.dependencies, 'dependencies');
        addDependencies(pkg.devDependencies, 'devDependencies');
        addDependencies(pkg.peerDependencies, 'peerDependencies');
        addDependencies(pkg.optionalDependencies, 'optionalDependencies');

        return {
            targetName: pkg.name || path.basename(filePath),
            targetVersion: pkg.version,
            description: pkg.description,
            filePath: filePath,
            packages
        };
    } catch (error: any) {
        throw new Error(`Failed to parse package.json at ${filePath}: ${error.message}`);
    }
}
