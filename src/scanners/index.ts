import { PackageDefinition, ScanTarget } from '../parsers/types';
import { runNpmAudit, NpmAuditResult } from './npmAudit';
import { runOsvScan, OsvVulnerability } from './osvApi';
import { runRegistryScan, RegistryAnalysis } from './registryApi';
import { resolveDependenciesDeep } from './dependencyResolver';

export interface TargetReport {
    targetName: string;
    targetVersion?: string;
    description?: string;
    filePath: string;
    packagesScanned: number;
    results: {
        package: string;
        version: string;
        source?: string;
        vulnCount: number;
        highestSeverity: string;
        isDeprecated: boolean;
        hasInstallScripts: boolean;
        npmUrl: string;
        maintainerDetails: string;
        issues: string[];
    }[];
    summary: {
        critical: number;
        high: number;
        moderate: number;
        low: number;
        total: number;
    };
}

export interface ScanReport {
    targetsScanned: number;
    targets: TargetReport[];
}

export interface ScanOptions {
    githubToken?: string;
    deep?: boolean;
}

export async function runFullScan(targets: ScanTarget[], options?: ScanOptions): Promise<ScanReport> {
    const report: ScanReport = { targetsScanned: targets.length, targets: [] };

    for (const target of targets) {

        let targetPackages = target.packages;
        if (options?.deep) {
            targetPackages = await resolveDependenciesDeep(targetPackages);
        }

        // Run API scans for all packages in this specific target
        const [npmAudit, osvResults, registryResults] = await Promise.all([
            runNpmAudit(targetPackages),
            runOsvScan(targetPackages),
            runRegistryScan(targetPackages, { githubToken: options?.githubToken })
        ]);

        const targetReport: TargetReport = {
            targetName: target.targetName,
            targetVersion: target.targetVersion,
            description: target.description,
            filePath: target.filePath,
            packagesScanned: targetPackages.length,
            results: [],
            summary: { critical: 0, high: 0, moderate: 0, low: 0, total: 0 }
        };

        if (npmAudit?.metadata?.vulnerabilities) {
            targetReport.summary.critical = npmAudit.metadata.vulnerabilities.critical;
            targetReport.summary.high = npmAudit.metadata.vulnerabilities.high;
            targetReport.summary.moderate = npmAudit.metadata.vulnerabilities.moderate;
            targetReport.summary.low = npmAudit.metadata.vulnerabilities.low;
            targetReport.summary.total = npmAudit.metadata.vulnerabilities.total;
        }

        for (const pkg of targetPackages) {
            let vulnCount = 0;
            let highestSeverity = 'None';
            const issues: string[] = [];
            let npmUrl = '';
            let maintainerDetails = '';

            const registry = registryResults.get(pkg.name);

            const osvVulns = osvResults.get(pkg.name) || [];
            if (osvVulns.length > 0) {
                vulnCount += osvVulns.length;

                osvVulns.forEach(vuln => {
                    let reportLine = `OSV: ${vuln.id} - ${vuln.summary || 'Vulnerability'}`;
                    const url = vuln.references?.find(r => r.type === 'ADVISORY' || r.type === 'WEB')?.url;
                    if (url) { reportLine += `\n  Url: ${url}`; }
                    issues.push(reportLine);
                });
                highestSeverity = 'Unknown';
            }

            if (npmAudit && npmAudit.vulnerabilities && npmAudit.vulnerabilities[pkg.name]) {
                const pkgVuln = npmAudit.vulnerabilities[pkg.name];
                let reportLine = `NPM Audit: ${pkgVuln.severity.toUpperCase()} severity.`;

                if (Array.isArray(pkgVuln.via)) {
                    const urls = pkgVuln.via
                        .filter((v: any) => typeof v === 'object' && v.url)
                        .map((v: any) => v.url);
                    if (urls.length > 0) {
                        reportLine += `\n  Url: ${urls.join('\n  Url: ')}`;
                    }
                }

                issues.push(reportLine);
                highestSeverity = pkgVuln.severity;
                vulnCount++;
            }

            let isDeprecated = false;
            let hasInstallScripts = false;

            if (registry) {
                if (registry.isDeprecated) {
                    isDeprecated = true;
                    issues.push(`DEPRECATED: ${registry.deprecationReason || 'No reason provided'}`);
                }
                if (registry.hasInstallScripts) {
                    hasInstallScripts = true;
                    issues.push(`RISKY SCRIPTS: Contains install scripts (${registry.installScriptsDetails?.join(', ') || ''})`);
                }

                if (registry.npmUrl) {
                    npmUrl = registry.npmUrl;
                }

                const maintDetails: string[] = [];

                const locationStr = registry.location ? ` [${registry.location}]` : '';

                if (registry.author) {
                    const a = registry.author;
                    if (typeof a === 'string') {
                        maintDetails.push(`Author: ${a}${locationStr}`);
                    } else {
                        const urlStr = a.url ? ` (${a.url})` : '';
                        maintDetails.push(`Author: ${a.name}${a.email ? ` <${a.email}>` : ''}${urlStr}${locationStr}`);
                    }
                }

                if (registry.maintainers && registry.maintainers.length > 0) {
                    let count = 1;
                    const maintainerStrs = registry.maintainers.map(m => {
                        const urlStr = m.url ? ` (${m.url})` : ` (https://www.npmjs.com/~${m.name})`;
                        return `${count++}. ${m.name}${m.email ? ` <${m.email}>` : ''}${urlStr}${locationStr}`;
                    });
                    maintDetails.push(`Maintainers:\n  ${maintainerStrs.join('\n  ')}`);
                }

                if (registry.repoUrl) {
                    const cleanUrl = registry.repoUrl.replace('git+', '').replace('.git', '');
                    maintDetails.push(`Repo: ${cleanUrl}`);
                }

                if (maintDetails.length > 0) {
                    maintainerDetails = maintDetails.join('\n');
                }
            }

            targetReport.results.push({
                package: pkg.name,
                version: pkg.version,
                source: pkg.source,
                vulnCount,
                highestSeverity,
                isDeprecated,
                hasInstallScripts,
                npmUrl,
                maintainerDetails,
                issues
            });
        }

        report.targets.push(targetReport);
    }

    return report;
}
