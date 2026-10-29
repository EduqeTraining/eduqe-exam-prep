// Eduqe Catch-all Vercel Serverless Function Handler
// Natively captures all /api/* requests (e.g. /api/auth/login, /api/courses, etc.)

const { handleRequest } = require('../src/server');

module.exports = async (req, res) => {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('Vercel Serverless Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'SERVERLESS_FUNCTION_ERROR',
      message: err.message
    }));
  }
};
