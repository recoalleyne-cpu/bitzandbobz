const http = require('http');

const PORT = process.env.PORT || 4000;
const URL = `http://localhost:${PORT}/health`;

console.log(`Checking API health at ${URL}...`);

const req = http.get(URL, (res) => {
    let data = '';
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        if (res.statusCode === 200) {
            try {
                const response = JSON.parse(data);
                if (response.ok === true) {
                    console.log('✅ API is healthy!');
                    process.exit(0);
                }
            } catch (e) {
                console.error('❌ Failed to parse health response');
            }
        }
        console.error(`❌ Health check failed with status: ${res.statusCode}`);
        process.exit(1);
    });
});

req.on('error', (err) => {
    console.error(`❌ API is not responding: ${err.message}`);
    process.exit(1);
});

req.end();
