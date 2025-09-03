const express = require('express');
const JsonPlaceholderClient = require('../clients/jsonPlaceholderClient');

const router = express.Router();

// Create a single instance of the client.  In a larger application you might
// inject this via dependency injection or a service locator.
const client = new JsonPlaceholderClient();

/**
 * GET /posts
 *
 * Returns a list of all posts by proxying the request to the upstream API.  If
 * the upstream request fails, the error will be caught by the error handler
 * registered in app.js.
 */
router.get('/', async (req, res, next) => {
  try {
    const { data } = await client.getPosts();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /posts/:id
 *
 * Returns a single post.  Validates that the id is numeric before forwarding
 * to the upstream service.
 */
router.get('/:id', async (req, res, next) => {
  const id = req.params.id;
  try {
    const { data } = await client.getPost(id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
