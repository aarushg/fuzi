const fs = require('fs');
const e = require('electron');
fs.writeFileSync('C:/Users/User/Documents/GitHub/fuzi/test-out3.txt',
  `type: ${process.type}\ne-type: ${typeof e}\ne: ${typeof e === 'string' ? 'PATH' : Object.keys(e).slice(0,5).join(',')}\n`);
if (e && e.app) { e.app.whenReady().then(() => e.app.quit()); } else { process.exit(0); }
