// Eduqe Vercel Serverless Function Handler
// Routes all /api/* requests to the authoritative Eduqe backend engine

const { handleRequest } = require('../src/server');

module.exports = async (req, res) => {
  try {
    return await handleRequest(req, res);
  } catch (err) {
    console.error('Vercel Serverless Invocation Error:', err);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      error: 'FUNCTION_INVOCATION_FAILED',
      message: err.message,
      stack: err.stack
    }));
  }
};
