// Receptor mock: hace de "servidor de App Demo" para ver los webhooks outbound.
const http = require('http');
const fs = require('fs');
let n = 0;
http
  .createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      n++;
      fs.appendFileSync(__dirname + '\\webhooks.log', `#${n} ${new Date().toISOString()}\n${body}\n---\n`);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id: `demo-ext-${n}` }));
    });
  })
  .listen(4999, () => console.log('receptor de App Demo en :4999'));
