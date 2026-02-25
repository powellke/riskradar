async function run() {
    const res = await fetch('https://registry.npmjs.org/-/user/org.couchdb.user:sindresorhus');
    if (res.ok) {
        console.log(await res.json());
    } else {
        console.error('Failed', res.status);
    }
}
run();
