import { app } from 'electron';
console.log('app type:', typeof app);
app.whenReady().then(() => { app.quit(); });
