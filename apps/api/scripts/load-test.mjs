// A basic load test for the API, with no dependencies (Node 22+ fetch).
//
//   node apps/api/scripts/load-test.mjs [apiUrl] [requests] [concurrency]
//
// Signs in to the demo account, then sends a mix of the reads the app makes on
// open (inbox, counts, labels, a thread, search) at the given concurrency, and
// prints latency percentiles and status codes. The default of 100 requests stays
// under the API's 120 requests a minute per IP; past that, the 429s are the rate
// limiter working, not a failure. Last, it checks that sign-in is throttled.

const api = (process.argv[2] ?? 'https://nem-mail-api.onrender.com/api/v1').replace(/\/$/, '');
const total = Number(process.argv[3] ?? 100);
const concurrency = Number(process.argv[4] ?? 10);

const DEMO = { email: 'alex@nemmail.example', password: 'demo-account' };

async function timed(path, init) {
	const start = performance.now();
	const response = await fetch(api + path, init);
	await response.arrayBuffer();
	return { status: response.status, ms: performance.now() - start, response };
}

function percentile(sorted, p) {
	return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

const json = { 'Content-Type': 'application/json' };
const signIn = await fetch(`${api}/auth/signin`, {
	method: 'POST',
	headers: json,
	body: JSON.stringify(DEMO)
});
if (!signIn.ok) throw new Error(`Demo sign-in failed: ${signIn.status}`);
const { token } = await signIn.json();
const auth = { Authorization: `Bearer ${token}` };

const inbox = await (
	await fetch(`${api}/threads?mailbox=inbox&limit=20`, { headers: auth })
).json();
const threadId = inbox.items[0].id;

const paths = [
	'/threads?mailbox=inbox&limit=50',
	'/counts',
	'/labels',
	`/threads/${threadId}`,
	'/search?q=invoice&limit=20'
];

const results = [];
let next = 0;
const started = performance.now();
await Promise.all(
	Array.from({ length: concurrency }, async () => {
		while (next < total) {
			const path = paths[next++ % paths.length];
			const { status, ms } = await timed(path, { headers: auth });
			results.push({ path, status, ms });
		}
	})
);
const seconds = (performance.now() - started) / 1000;

const ms = results.map((r) => r.ms).sort((a, b) => a - b);
const statuses = Object.groupBy(results, (r) => r.status);
console.log(`${api}: ${total} requests, concurrency ${concurrency}, ${seconds.toFixed(1)} s`);
console.log(`throughput ${(total / seconds).toFixed(1)} req/s`);
console.log(
	`latency p50 ${percentile(ms, 50).toFixed(0)} ms, p95 ${percentile(ms, 95).toFixed(0)} ms, ` +
		`p99 ${percentile(ms, 99).toFixed(0)} ms, max ${ms.at(-1).toFixed(0)} ms`
);
console.log(
	'status',
	Object.fromEntries(Object.entries(statuses).map(([code, rows]) => [code, rows.length]))
);
for (const path of paths) {
	const own = results
		.filter((r) => r.path === path)
		.map((r) => r.ms)
		.sort((a, b) => a - b);
	console.log(`  ${path.padEnd(36)} p50 ${percentile(own, 50).toFixed(0)} ms`);
}

// Brute force: 12 wrong passwords in a row; the auth limit is 10 a minute per IP.
const wrong = [];
for (let i = 0; i < 12; i++) {
	const { status } = await timed('/auth/signin', {
		method: 'POST',
		headers: json,
		body: JSON.stringify({ email: DEMO.email, password: `wrong-${i}` })
	});
	wrong.push(status);
}
console.log('12 wrong sign-ins:', wrong.join(' '));
