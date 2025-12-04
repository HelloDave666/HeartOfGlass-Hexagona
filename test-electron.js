const electron = require('electron');
console.log('Type of electron:', typeof electron);
console.log('Is string?:', typeof electron === 'string');
console.log('First 10 keys:', typeof electron === 'object' ? Object.keys(electron).slice(0, 10) : 'N/A');

const { app, BrowserWindow } = require('electron');
console.log('app:', app);
console.log('BrowserWindow:', BrowserWindow);
