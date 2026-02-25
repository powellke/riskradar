async function run() {
    const res = await fetch('https://registry.npmjs.org/lodash');
    if (res.ok) {
        const data = await res.json();
        console.log("Author:", data.author);
        console.log("Maintainers:", data.maintainers);
        console.log("Publisher:", data.publisher);
    } else {
        console.error('Failed', res.status);
    }
}
run();
