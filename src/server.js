/*
 * Entry point for running the Express server.  When developing or deploying
 * this API you can run `node src/server.js` to start the application.  In
 * tests we import the Express app directly and bypass the need to start
 * listening on a port.
 */
const app = require('./app');

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`API server listening on port ${port}`);
});
