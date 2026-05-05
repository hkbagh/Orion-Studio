const fs = require('fs');

async function test() {
  const zipBuf = fs.readFileSync('test.zip');
  try {
    const res = await fetch('http://localhost:3001/api/translate/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Source-Lang': 'javascript',
      },
      body: zipBuf
    });
    const text = await res.text();
    console.log(res.status, text);
  } catch(e) {
    console.error(e);
  }
}
test();
