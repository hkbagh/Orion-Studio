const http = require('http');
http.get('http://localhost:3001/api/translate/097183b6/stream?sourceLang=javascript&targetLang=python', (res) => {
  res.on('data', (chunk) => {
    console.log(chunk.toString());
  });
});
