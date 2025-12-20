const http = require('http');
http.get('http://localhost:4000/api/departments', (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            json.forEach(d => console.log(`Name: '${d.name}', Head: '${d.head_name}'`));
        } catch (e) {
            console.log('Error parsing JSON', e);
            console.log('Raw:', data);
        }
    });
});
