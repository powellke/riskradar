import { exec } from 'child_process';
import util from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { PackageDefinition } from '../parsers/types';

const execPromise = util.promisify(exec);

export interface NpmAuditResult {
    vulnerabilities: Record<string, any>;
    metadata: {
        vulnerabilities: {
            info: number;
            low: number;
            moderate: number;
            high: number;
            critical: number;
            total: number;
        }
    }
}

export async function runNpmAudit(packages: PackageDefinition[]): Promise<NpmAuditResult | null> {
    if (packages.length === 0) return null;

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'riskradar-audit-'));

    // Create a synthetic package.json with dependencies
    const dependencies: Record<string, string> = {};
    packages.forEach(p => {
        dependencies[p.name] = p.version;
    });

    const packageJson = {
        name: "riskradar-synthetic-audit-target",
        version: "1.0.0",
        dependencies
    };

    fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify(packageJson, null, 2));

    try {
        // We must install packages first for npm audit to work effectively because 
        // it analyzes the package-lock.json and dependency tree.
        // However, a full install is slow and could execute malicious postinstall scripts.
        // Instead, we can use `npm install --package-lock-only --ignore-scripts --legacy-peer-deps --force`
        await execPromise('npm install --package-lock-only --ignore-scripts --legacy-peer-deps --force', { cwd: tmpDir, shell: 'cmd.exe' });
    } catch (installError: any) {
        console.warn('\n[Warning] npm audit skipped: Could not resolve dependency tree (likely due to missing or severely conflicting upstream packages).');
        return null;
    }

    try {
        // Run audit
        const { stdout, stderr } = await execPromise('npm audit --json', { cwd: tmpDir, shell: 'cmd.exe' });
        return JSON.parse(stdout) as NpmAuditResult;
    } catch (error: any) {
        // npm audit returns a non-zero exit code if vulnerabilities are found!
        // So error.stdout will contain the JSON output in that case.
        if (error.stdout) {
            try {
                return JSON.parse(error.stdout) as NpmAuditResult;
            } catch {
                throw new Error(`npm audit failed and output could not be parsed: ${error.message}`);
            }
        }
        throw new Error(`npm audit failed: ${error.message}`);
    } finally {
        // Cleanup
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch { /* ignore cleanup errors */ }
    }
}
