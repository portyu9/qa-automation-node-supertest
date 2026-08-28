const express = require('express');

function positiveInteger(value) {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function createPostsRouter({ client }) {
  if (!client || typeof client.getPosts !== 'function' || typeof client.getPost !== 'function') {
    throw new Error('posts client must implement getPosts() and getPost(id)');
  }

  const router = express.Router();

  router.get('/', async (req, res, next) => {
    try {
      const { data } = await client.getPosts();
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get('/:id', async (req, res, next) => {
    const id = positiveInteger(req.params.id);
    if (id === null) {
      return res.status(400).json({
        error: 'invalid_post_id',
        requestId: req.requestId,
      });
    }

    try {
      const { data } = await client.getPost(id);
      return res.json(data);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createPostsRouter, positiveInteger };
