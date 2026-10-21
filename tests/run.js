require('./trainer.test.js');
require('./filters.test.js');
require('./ui.test.js');
(async function () {
  const filters = await runFilterTests();
  const ui = await runUITests();
  console.log(`${engineTestResult} ${filters} ${ui}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
