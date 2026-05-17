const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

http.createServer(function(req, res) {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, function(err, data) {
    if (err) {
      res.writeHead(500);
      res.end('Hata: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, function() {
  console.log('B24 Rapor sunucusu çalışıyor: http://localhost:' + PORT);
});
