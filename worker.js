var main = require('./src/main');
var cron = require('node-cron');
 
cron.schedule('* * * * * *', () => {
  console.log(new Date())
  main()
});