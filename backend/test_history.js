const http = require('http');

// 1. Get Departments
http.get('http://localhost:4000/api/departments', (res) => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => {
        const depts = JSON.parse(data);
        const dept = depts[0]; // Pick first one
        console.log('Update Dept:', dept.name, dept.id);

        // 2. Update Head
        const putData = JSON.stringify({
            head_name: "New Head " + Date.now(),
            head_email: "new@head.com"
        });

        const req = http.request({
            hostname: 'localhost',
            port: 4000,
            path: `/api/departments/${dept.id}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': putData.length
            }
        }, (res2) => {
            res2.on('data', () => { });
            res2.on('end', () => {
                console.log('Update finished. Fetching History...');
                // 3. Fetch History
                http.get(`http://localhost:4000/api/departments/${dept.id}/history`, (res3) => {
                    let histData = '';
                    res3.on('data', c => histData += c);
                    res3.on('end', () => {
                        console.log('History:', histData);
                    });
                });
            });
        });
        req.write(putData);
        req.end();
    });
});
