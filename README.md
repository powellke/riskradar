# 📡 Risk Radar

Risk Radar is a powerful, fully-functioning TypeScript command-line utility for scanning Node.js dependencies against multiple vulnerability indexers and origin trackers simultaneously. It analyzes `package.json` definitions, `.csv` target lists, and even uploaded `.zip` archives.

Risk Radar integrates with the **Google OSV** (Open Source Vulnerability) database, the native **NPM Registry API**, and native **NPM Audit** processes to provide comprehensive visibility into the health, security, and maintenance status of your software supply chain.

## 🚀 Key Features

* **Multi-Source Ingestion**:
  * Scan local `package.json` (extracting `dependencies` and `devDependencies`).
  * Scan bulk CSV lists outlining packages and versions across various targets.
  * Extract and parse configurations from zipped source code archives (`.zip`).
* **Deep Transitive Scanning (`--deep`)**: 
  * Unroll your target packages into their entire dependency trees using the native `npm ls` lockfile generator.
  * Find vulnerabilities nested 10 layers deep that standard top-level checkers miss.
* **Triple-Threat Vulnerability Detection**:
  * **Google OSV API**: Direct queries mapping packages to exact GitHub Advisories.
  * **NPM Audit**: Generates a resilient, synthetic locking project to securely execute and analyze `npm audit` reports against target packages.
  * **Metadata Inspection**: Spots deprecated packages and missing source repositories.
* **Origin Extraction**: Tracks geographical locations by mapping NPM repository authors against the GitHub User Profile API.

## 📦 Installation & Setup

Risk Radar requires **Node.js 18+**.

1. Clone the repository and install dependencies:
```bash
git clone https://github.com/powellke/riskradar.git
cd riskradar
npm install
```

2. Build the TypeScript source into JavaScript executable blobs:
```bash
npm run build
```

3. Link the package globally so you can run the `riskradar` command anywhere on your machine:
```bash
npm link
```

## 🛠️ Generating Standalone Executables (Optional)
If you want to package Risk Radar into a highly portable executable that doesn't require a host machine to have Node.js installed, use the built-in packaging script:

```bash
npm run package
```
*This command uses `pkg` to compile binary targets for Windows (`.exe`), macOS, and Linux, which are deposited into the `/bin` directory.*

## 💻 Usage Instructions

### Basic Usage
The primary command is `scan`, requiring an `--input` target file.

```bash
# Scan a local package.json
riskradar scan -i package.json
```

```bash
# Scan a zipped code directory containing multiple package.json targets
riskradar scan -i my-project-code.zip
```

```bash
# Scan a CSV file containing 3rd-party dependencies
riskradar scan -i external_dependencies.csv
```

### 🕷️ Deep Transitive Mode (Deep Scanning)
To fully resolve every transitive dependency associated with your targets, pass the `-d` or `--deep` flag.

```bash
riskradar scan -i package.json --deep
```

### 📤 Output Formats & Redirection
Risk Radar outputs beautifully styled console tables by default, but you can export the data to various resilient formats using `--output <formats>`:

**Available Output Formats**: `table`, `json`, `csv`, `markdown`

You can sequentially chain output formats by separating them with commas! For instance, if you want both a Markdown Document AND a generic CSV spreadsheet:

```bash
riskradar scan -i package.json --deep --output markdown,csv
```

If you don't want to redirect stdout (`> output.md`), use the `--file <base_name>` switch to cleanly write the reports to the filesystem natively with automatic proper file extensions.

```bash
# This will silently write `scan_report.md` and `scan_report.csv` directly to the active folder
riskradar scan -i package.json --output markdown,csv --file scan_report 
```

### 🗝️ Bypassing GitHub Location API Rate Limits
Geographic location tracking relies on querying package repository owners against the public GitHub User API. Unauthenticated requests are harshly clamped to **60 lookups per hour**. 

To bypass this restriction and increase the limit to **5,000 requests per hour**, provide a GitHub Personal Access Token (PAT):

```bash
riskradar scan -i package.json --github-token your_token_here
```

*(Alternatively, you can just set the `GITHUB_TOKEN` environment variable on your machine before running the app).*
