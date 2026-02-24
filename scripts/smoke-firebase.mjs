import http from 'http';

const PORT = 5002; // Firebase Hosting Emulator port
const HOST = 'localhost';

async function checkUrl(path, expectedStatus = 200) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: HOST,
            port: PORT,
            path: path,
            method: 'GET',
        };

        const req = http.request(options, (res) => {
            if (res.statusCode === expectedStatus) {
                console.log(`✅ ${path} returned ${res.statusCode}`);
                resolve(true);
            } else {
                console.error(`❌ ${path} returned ${res.statusCode} (expected ${expectedStatus})`);
                resolve(false);
            }
        });

        req.on('error', (e) => {
            console.error(`❌ Failed to connect to ${path}: ${e.message}`);
            resolve(false);
        });

        req.end();
    });
}

async function run() {
    console.log('🚀 Starting Firebase Smoke Tests...');

    // 1. Check root
    const rootOk = await checkUrl('/');

    // 2. Check deep route (SPA rewrite)
    const deepOk = await checkUrl('/test-route-random-123');

    if (rootOk && deepOk) {
        console.log('✨ All Firebase smoke tests passed!');
        process.exit(0);
    } else {
        console.error('💥 Some smoke tests failed. Ensure emulators are running.');
        process.exit(1);
    }
}

run();
