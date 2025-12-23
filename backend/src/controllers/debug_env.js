const path = require('path');
const fs = require('fs');

console.log('Script running from:', __filename);
console.log('__dirname:', __dirname);
const envPath = path.resolve(__dirname, '../../.env');
console.log('Resolved Path:', envPath);

try {
    if (fs.existsSync(envPath)) {
        console.log('File exists.');
        const content = fs.readFileSync(envPath, 'utf8');
        console.log('--- CONTENT START ---');
        console.log(content.split('\n').filter(l => l.includes('GMAIL')).join('\n'));
        console.log('--- CONTENT END ---');
    } else {
        console.log('File NOT found at resolved path.');
    }
} catch (e) {
    console.error('Error:', e);
}
