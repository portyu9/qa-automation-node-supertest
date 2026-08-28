const express = require('express');
const JsonPlaceholderClient = require('./clients/jsonPlaceholderClient');
const { loadConfig } = require('./config');
const { requestContext } = require('./middleware/requestContext');
const { createPostsRouter } = require('./routes/posts');

function createApp({ postsClient, config } = {}) {
  const runtimeConfig = config || loadConfig();
  const client =
    postsClient ||
    new JsonPlaceholderClient(runtimeConfig.upstreamBaseUrl, {
      timeoutMs: runtimeConfig.requestTimeoutMs,
    });

  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', requestId: req.requestId });
  });

  app.use('/posts', createPostsRouter({ client }));

  app.use((req, res) => {
    res.status(404).json({
      error: 'not_found',
      requestId: req.requestId,
    });
  });

  app.use((err, req, res, next) => {
    void next;
    // Log only safe diagnostic fields; request bodies and authorization headers
    // are intentionally excluded.
    console.error({ requestId: req.requestId, error: err.name, message: err.message });
    res.status(500).json({
      error: 'internal_server_error',
      requestId: req.requestId,
    });
  });

  return app;
}

const app = createApp();

module.exports = app;
module.exports.createApp = createApp;
