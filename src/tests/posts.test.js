const request = require('supertest');
const app = require('../app');

// Integration tests for the /posts API endpoints.  These tests use
// SuperTest to send HTTP requests directly against the Express app without
// binding to a network port.  The upstream JSONPlaceholder API is called
// as part of the route handlers, so network access is required.

describe('/posts endpoints', () => {
  jest.setTimeout(10000); // increase timeout for network I/O

  test('GET /posts returns an array of posts', async () => {
    const res = await request(app).get('/posts');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // verify the first element has expected keys
    const post = res.body[0];
    expect(post).toHaveProperty('id');
    expect(post).toHaveProperty('userId');
    expect(post).toHaveProperty('title');
  });

  test('GET /posts/:id returns a specific post', async () => {
    const id = 1;
    const res = await request(app).get(`/posts/${id}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id', id);
    expect(res.body).toHaveProperty('userId');
    expect(res.body).toHaveProperty('title');
    expect(res.body).toHaveProperty('body');
  });
});
