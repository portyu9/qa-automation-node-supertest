const { createApp } = require('./app');
const { loadConfig } = require('./config');

const config = loadConfig();
const app = createApp({ config });
const server = app.listen(config.port, () => {
  console.log(`API server listening on port ${config.port}`);
});

function shutdown(signal) {
  console.log(`Received ${signal}; closing HTTP server`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
