const express = require('express');

// Import the posts router.  Splitting routes into separate modules keeps
// this file concise and makes it easy to extend the API with additional
// resources later on.
const postsRouter = require('./routes/posts');

const app = express();

// Parse JSON bodies on incoming requests
app.use(express.json());

// Mount the posts routes under /posts
app.use('/posts', postsRouter);

// Generic error handler – if any async route throws an error it will be
// forwarded here and converted into a JSON response.
app.use((err, req, res, next) => {
  // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

module.exports = app;
