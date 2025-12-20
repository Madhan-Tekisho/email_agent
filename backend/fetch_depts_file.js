const fs = require('fs');
const http = require('http');
http.get('http://localhost:4000/api/departments', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            const out = json.map(d => `ID: ${d.id} | Name: "${d.name}" | Head: "${d.head_name}" | Email: "${d.head_email}"`).join('\n');
            fs.writeFileSync('dept_names.txt', out);
            console.log('Done');
        } catch (e) { console.error(e); }
    });
});
