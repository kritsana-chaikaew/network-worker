var main = require('./src/main');
var cron = require('node-cron');
 
cron.schedule('0 * * * * *', () => {
  console.log(new Date())
  main()
});
