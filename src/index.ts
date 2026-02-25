#!/usr/bin/env node
import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import { parseInputFile } from './parsers';
import { runFullScan } from './scanners';
import { printReport } from './reporters';

const program = new Command();

program
    .name('riskradar')
    .description('NPM Package Vulnerability and Risk Scanner')
    .version('1.0.0');

program
    .command('scan')
    .description('Scan packages from a package.json, CSV, or Zip file')
    .requiredOption('-i, --input <path>', 'Path to the input file (package.json, .csv, or .zip)')
    .option('-o, --output <formats>', 'Output formats: table, json, markdown, csv (comma-separated)', 'table')
    .option('-f, --file <path>', 'Base filename to write output reports to (e.g. "report" generates "report.md" and "report.csv")')
    .option('-d, --deep', 'Perform a deep scan resolving all transitive dependency layers (slower)')
    .option('--github-token <token>', 'GitHub Personal Access Token to bypass location lookup rate limits (can also set GITHUB_TOKEN env var)')
    .action(async (options) => {
        const formats = options.output.split(',').map((f: string) => f.trim().toLowerCase());
        const quietMode = !formats.includes('table');
        const githubToken = options.githubToken || process.env.GITHUB_TOKEN;
        const deep = options.deep || false;

        if (!quietMode) console.log(chalk.blue(`Initializing Risk Radar scan for: ${options.input}...`));

        try {
            const targets = await parseInputFile(options.input);
            const totalPkgs = targets.reduce((sum, t) => sum + t.packages.length, 0);
            if (!quietMode) console.log(chalk.green(`Successfully parsed ${totalPkgs} packages across ${targets.length} source file(s).`));

            if (!quietMode && deep) {
                console.log(chalk.yellow(`Deep scanning enabled. Resolving full transitive dependencies...`));
            }

            if (!quietMode) console.log(chalk.cyan(`Starting vulnerability, registry, and audit scans...`));
            const report = await runFullScan(targets, { githubToken, deep });

            for (const format of formats) {
                printReport(report, format as any, options.file);
            }

        } catch (error: any) {
            console.error(chalk.red(`Error: ${error.message}`));
            process.exit(1);
        }
    });

program.parse();
