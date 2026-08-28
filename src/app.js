const express = require('express');
const postsRouter = require('./routes/posts');
const { requestContext } = require('./middleware/requestContext');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));
app.use(requestContext);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', requestId: req.requestId });
});

app.use('/posts', postsRouter);

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

module.exports = app;
