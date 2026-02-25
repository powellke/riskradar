import Table from 'cli-table3';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { ScanReport } from '../scanners';

export function printReport(report: ScanReport, format: 'table' | 'json' | 'markdown' | 'csv', outFile?: string) {
    let outputBuffer = '';

    if (format === 'json') {
        outputBuffer = JSON.stringify(report, null, 2);
    } else if (format === 'csv') {
        outputBuffer += 'Target,Package,Version,Vulns,Highest Sev,Deprecated?,Issues,NPM Link,Maintainers\n';
        report.targets.forEach(target => {
            target.results.forEach(res => {
                const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
                outputBuffer += `${escape(target.targetName)},${escape(res.package)},${escape(res.version)},${res.vulnCount},${escape(res.highestSeverity)},${res.isDeprecated ? 'YES' : 'No'},${escape(res.issues.join('; '))},${escape(res.npmUrl)},${escape(res.maintainerDetails.replace(/\n/g, ' | '))}\n`;
            });
        });
    } else if (format === 'markdown') {
        outputBuffer += '# Risk Radar Scan Report\n\n';

        report.targets.forEach(target => {
            outputBuffer += `## Target: ${target.targetName}\n`;
            if (target.description) outputBuffer += `*${target.description}*\n`;
            if (target.targetVersion) outputBuffer += `**Version**: ${target.targetVersion}\n`;
            outputBuffer += `**Packages Scanned:** ${target.packagesScanned}  \n`;
            outputBuffer += `**Critical:** ${target.summary.critical} | **High:** ${target.summary.high} | **Moderate:** ${target.summary.moderate} | **Low:** ${target.summary.low}  \n\n`;

            outputBuffer += '| Package | Version | Vulns | Highest Sev | Deprecated? | Issues | NPM Link | Maintainers |\n';
            outputBuffer += '|---|---|---|---|---|---|---|---|\n';
            target.results.forEach(res => {
                const escape = (s: string) => s.replace(/\n/g, '<br>');
                outputBuffer += `| ${res.package} | ${res.version} | ${res.vulnCount} | ${res.highestSeverity} | ${res.isDeprecated ? 'YES' : 'No'} | ${escape(res.issues.join('<br>')) || 'None'} | [Link](${res.npmUrl}) | ${escape(res.maintainerDetails)} |\n`;
            });
            outputBuffer += '\n\n';
        });
    } else {
        // TABLE FORMAT (Always stdout, does not write to file easily due to ANSI colors unless stripped, but user mostly asked for md/csv output separation)
        report.targets.forEach(target => {
            console.log(chalk.bold.inverse(`\n --- TARGET: ${target.targetName} ` + (target.targetVersion ? `(v${target.targetVersion}) ` : '') + `--- `));
            if (target.description) {
                console.log(chalk.italic(`     ${target.description}`));
            }
            console.log(chalk.dim(`     Path: ${target.filePath}`));

            const table = new Table({
                head: [
                    chalk.cyan('Package'),
                    chalk.cyan('Version'),
                    chalk.cyan('Vulns'),
                    chalk.cyan('Highest Sev'),
                    chalk.cyan('Deprecated?'),
                    chalk.cyan('Issues'),
                    chalk.cyan('NPM Link'),
                    chalk.cyan('Maintainers')
                ],
                wordWrap: true,
                wrapOnWordBoundary: false,
                colWidths: [18, 10, 8, 14, 12, 30, 25, 40]
            });

            target.results.forEach(res => {
                table.push([
                    res.package,
                    res.version,
                    res.vulnCount > 0 ? chalk.red(res.vulnCount.toString()) : chalk.green('0'),
                    res.highestSeverity === 'None' ? chalk.green('None') : chalk.red(res.highestSeverity),
                    res.isDeprecated ? chalk.red('YES') : chalk.green('No'),
                    res.issues.join('\n') || chalk.green('None'),
                    chalk.blue(res.npmUrl),
                    chalk.gray(res.maintainerDetails)
                ]);
            });

            console.log('\n' + table.toString());

            console.log(chalk.bold(' >> Scan Summary: ' + target.targetName));
            console.log(`    Packages Scanned: ${target.packagesScanned}`);
            console.log(chalk.red(`    Critical: ${target.summary.critical}`));
            console.log(chalk.red(`    High:       ${target.summary.high}`));
            console.log(chalk.yellow(`    Moderate:   ${target.summary.moderate}`));
            console.log(chalk.blue(`    Low:        ${target.summary.low}`));
            console.log(`    Total Vulns: ${target.summary.total}`);
        });
        return; // Early return for table since it uses direct chalk stdout mapping
    }

    if (outFile) {
        // Determine proper extension
        let ext = format === 'markdown' ? '.md' : `.${format}`;

        // Ensure base filename is modified per format if multiple are provided so they don't overwrite
        const parsedPath = path.parse(outFile);
        // Ex: if user provides `out`, we write `out.md` and `out.csv`
        // If user provides `report.csv`, and requests markdown, we write `report.md`
        const finalPath = path.join(parsedPath.dir, `${parsedPath.name}${ext}`);

        fs.writeFileSync(finalPath, outputBuffer);
        console.log(chalk.green(`\n✓ Output successfully written to ${finalPath}`));
    } else {
        console.log(outputBuffer);
    }
}
