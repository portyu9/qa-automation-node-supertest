const express = require('express');
const PostsUpstreamClient = require('./clients/postsUpstreamClient');
const { UpstreamServiceError } = require('./clients/upstreamError');
const { loadConfig } = require('./config');
const { requestContext } = require('./middleware/requestContext');
const { createPostsRouter } = require('./routes/posts');

function createApp({ postsClient, config } = {}) {
  let client = postsClient;
  if (!client) {
    const runtimeConfig = config || loadConfig();
    client = new PostsUpstreamClient(runtimeConfig.upstreamBaseUrl, {
      timeoutMs: runtimeConfig.requestTimeoutMs,
    });
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));
  app.use(requestContext);

  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', requestId: req.requestId });
  });

  app.use('/posts', createPostsRouter({ client }));

  app.use((req, res) => {
    res.status(404).json({ error: 'not_found', requestId: req.requestId });
  });

  app.use((err, req, res, next) => {
    void next;
    const isUpstream = err instanceof UpstreamServiceError;
    const statusCode = isUpstream ? err.statusCode : 500;
    const code = isUpstream ? err.publicCode : 'internal_server_error';

    console.error({ requestId: req.requestId, error: err.name, code, statusCode });
    res.status(statusCode).json({ error: code, requestId: req.requestId });
  });

  return app;
}

module.exports = { createApp };
