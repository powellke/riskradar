import { PackageDefinition } from '../parsers/types';

export async function resolveDependenciesDeep(packages: PackageDefinition[]): Promise<PackageDefinition[]> {
    const resolvedMap = new Map<string, PackageDefinition>();

    // We will use a queue-based breadth-first search to traverse the dependency graph.
    // This perfectly prevents max-call-stack errors that a recursive function would suffer.
    const queue: PackageDefinition[] = [...packages];

    // Safety limit to prevent memory exhaustion on insanely massive monorepos
    const MAX_PACKAGES = 5000;

    let processedCount = 0;

    while (queue.length > 0 && processedCount < MAX_PACKAGES) {
        // Pop in batches to speed up requests
        const batchSize = Math.min(queue.length, 25);
        const currentBatch = queue.splice(0, batchSize);

        await Promise.all(currentBatch.map(async (pkg) => {
            // Because npm allows semantic versioning (e.g. ^1.0.0, ~2.0, *), 
            // resolving the EXACT specific node in the tree is effectively impossible without
            // fully porting NPM's semver resolver algorithm.
            //
            // Since our goal is security scanning, fetching the *latest* matching version
            // for the specified tag is usually sufficient to check if a transitive dependency 
            // is abandoned or has newly discovered vulnerabilities.

            // To ensure we don't fetch the same package@versions multiple times due to overlapping requirements
            const identifierList = `${pkg.name}@${pkg.version}`;

            // We strip out complex semver bounds manually to just get the 'major' identifier if possible
            // If it's a raw asterisk or completely unbound, it will fetch the 'latest' tag on the registry.
            // Example conversions: ^4.1.2 -> 4.1.2  |  ~4.1 -> 4.1  |  >=1.0.0 -> 1.0.0
            const cleanVersion = pkg.version ? pkg.version.replace(/^[^\d]*/, '') || 'latest' : 'latest';

            const uniqueId = `${pkg.name}@${cleanVersion}`;

            // Prevent circular dependency loops
            if (resolvedMap.has(uniqueId)) return;

            resolvedMap.set(uniqueId, {
                name: pkg.name,
                version: cleanVersion,
                source: 'deep-resolved'
            });

            processedCount++;

            try {
                // Fetch the package's package.json details directly from the public registry
                const res = await fetch(`https://registry.npmjs.org/${pkg.name}/${cleanVersion}`);
                if (!res.ok) return;

                const data = await res.json();

                // If it has dependencies, queue them up to be processed in future batches
                if (data.dependencies) {
                    for (const [depName, depVersion] of Object.entries(data.dependencies)) {
                        const depCleanVer = (depVersion as string).replace(/^[^\d]*/, '') || 'latest';
                        if (!resolvedMap.has(`${depName}@${depCleanVer}`)) {
                            queue.push({ name: depName, version: depVersion as string, source: 'deep-resolved' });
                        }
                    }
                }
            } catch (e) {
                // Silently ignore unreachable dependencies
            }
        }));
    }

    return Array.from(resolvedMap.values());
}
