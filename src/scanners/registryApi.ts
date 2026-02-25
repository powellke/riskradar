import { PackageDefinition } from '../parsers/types';

export interface RegistryAnalysis {
    isDeprecated: boolean;
    deprecationReason?: string;
    hasInstallScripts: boolean;
    installScriptsDetails?: string[];
    latestVersion?: string;
    description?: string;
    maintainers?: { name: string; email?: string, url?: string }[];
    author?: { name: string; email?: string, url?: string } | string;
    repoUrl?: string;
    npmUrl?: string;
    location?: string;
}

export interface RegistryScanOptions {
    githubToken?: string;
}

export async function runRegistryScan(packages: PackageDefinition[], options?: RegistryScanOptions): Promise<Map<string, RegistryAnalysis>> {
    const resultsMap = new Map<string, RegistryAnalysis>();

    // Cache for GitHub locations to avoid blasting the unauthenticated API limit (60 req/hr)
    const locationCache = new Map<string, string>();
    let githubRateLimited = false;

    // Use Promise.all with a concurrency limit if the list is long,
    // but for simplicity we will handle in chunks of 10 to avoid blasting the registry.
    const CONCURRENCY = 10;

    for (let i = 0; i < packages.length; i += CONCURRENCY) {
        const batch = packages.slice(i, i + CONCURRENCY);

        await Promise.all(batch.map(async (pkg) => {
            try {
                // Fetch from npm registry
                // E.g., https://registry.npmjs.org/lodash/4.17.20 or just the package metadata
                const url = `https://registry.npmjs.org/${encodeURIComponent(pkg.name)}`;
                const response = await fetch(url);

                if (!response.ok) {
                    // Might be a private package or not found
                    return;
                }

                const data = await response.json();
                const latestVersion = data['dist-tags']?.latest;

                // Use the specified version or the latest if not found/specified
                const versionToAnalyze = pkg.version !== 'latest' && data.versions[pkg.version] ? pkg.version : latestVersion;
                const versionData = data.versions[versionToAnalyze];

                if (!versionData) return;

                const analysis: RegistryAnalysis = {
                    isDeprecated: !!versionData.deprecated,
                    deprecationReason: versionData.deprecated,
                    hasInstallScripts: false,
                    latestVersion: latestVersion,
                    description: data.description,
                    maintainers: data.maintainers,
                    author: versionData.author || data.author,
                    repoUrl: versionData.repository?.url || data.repository?.url,
                    npmUrl: `https://www.npmjs.com/package/${pkg.name}`
                };

                const scripts = versionData.scripts || {};
                const riskyScripts = ['preinstall', 'install', 'postinstall'];
                const foundScripts = riskyScripts.filter(s => scripts[s]);

                if (foundScripts.length > 0) {
                    analysis.hasInstallScripts = true;
                    analysis.installScriptsDetails = foundScripts.map(s => `${s}: ${scripts[s]}`);
                }

                // Best-effort geographic location extraction from GitHub
                if (analysis.repoUrl && !githubRateLimited) {
                    const match = analysis.repoUrl.match(/github\.com\/([^\/]+)/);
                    if (match) {
                        const owner = match[1];
                        if (locationCache.has(owner)) {
                            const cached = locationCache.get(owner);
                            if (cached) analysis.location = cached;
                        } else {
                            try {
                                const headers: any = { 'User-Agent': 'RiskRadar-Security-Scanner' };
                                if (options?.githubToken) {
                                    headers['Authorization'] = `Bearer ${options.githubToken}`;
                                }
                                const ghRes = await fetch(`https://api.github.com/users/${owner}`, { headers });
                                if (ghRes.ok) {
                                    const ghData = await ghRes.json();
                                    if (ghData.location) {
                                        analysis.location = ghData.location;
                                        locationCache.set(owner, ghData.location);
                                    } else {
                                        locationCache.set(owner, '');
                                    }
                                } else if (ghRes.status === 403) {
                                    githubRateLimited = true;
                                    console.warn(`[Warning] GitHub API rate limit reached. Geographic location lookups suspended.`);
                                } else {
                                    locationCache.set(owner, '');
                                }
                            } catch (e) {
                                locationCache.set(owner, '');
                            }
                        }
                    }
                }

                resultsMap.set(pkg.name, analysis);

            } catch (error: any) {
                console.warn(`[Warning] Failed to query NPM registry for ${pkg.name}: ${error.message}`);
            }
        }));
    }

    return resultsMap;
}
