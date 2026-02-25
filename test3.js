async function run() {
    // 1. extract owner from repo url
    const repoUrl = 'git+https://github.com/lodash/lodash.git';
    const match = repoUrl.match(/github\.com\/([^\/]+)/);
    if (match) {
        const owner = match[1];
        try {
            const res = await fetch(`https://api.github.com/users/${owner}`, {
                headers: { 'User-Agent': 'RiskRadar-Scanner' }
            });
            if (res.ok) {
                const data = await res.json();
                console.log("Location:", data.location);
            } else {
                console.error('GitHub API failed', res.status);
            }
        } catch (e) { console.error(e); }
    }
}
run();
