import GoogleSheetsService from '../src/services/googleSheetsService.js';

const sheetsService = new GoogleSheetsService();

console.log('📋 Available methods for script breakdown:');
const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(sheetsService))
  .filter(name => name !== 'constructor' && typeof sheetsService[name] === 'function')
  .filter(name => name.toLowerCase().includes('script') || name.toLowerCase().includes('breakdown'));

methods.forEach(method => console.log('  -', method));

console.log('\n📋 Available get methods:');
const getMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(sheetsService))
  .filter(name => name !== 'constructor' && typeof sheetsService[name] === 'function')
  .filter(name => name.startsWith('get'));

getMethods.forEach(method => console.log('  -', method));