export interface PackageDefinition {
    name: string;
    version: string;
    source?: string; // Where it came from (e.g. "package.json dependencies", "csv line 2")
}

export interface ScanTarget {
    targetName: string; // E.g., package name or CSV filename
    targetVersion?: string;
    description?: string;
    filePath: string;
    packages: PackageDefinition[];
}
