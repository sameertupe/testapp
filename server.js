const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Tracks active test state per session
let state = {
  running: false,
  rps: 1,
  sent: 0,
  errors: 0,
  intervalId: null,
  targetUrl: 'http://localhost:8190/hello'
};

function sendRequest() {
  return new Promise((resolve) => {
    const url = new URL(state.targetUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname,
      method: 'GET'
    };
    const req = http.request(options, (res) => {
      res.resume();
      state.sent++;
      resolve({ status: res.statusCode });
    });
    req.on('error', () => { state.errors++; resolve({ status: 0 }); });
    req.setTimeout(5000, () => { req.destroy(); state.errors++; resolve({ status: 0 }); });
    req.end();
  });
}

app.post('/api/start', (req, res) => {
  const { rps, targetUrl } = req.body;
  if (state.running) {
    clearInterval(state.intervalId);
  }
  state.running = true;
  state.rps = Math.max(1, Math.min(parseInt(rps) || 1, 100));
  state.targetUrl = targetUrl || 'http://localhost:8190/hello';
  state.sent = 0;
  state.errors = 0;

  const intervalMs = Math.floor(1000 / state.rps);
  state.intervalId = setInterval(sendRequest, intervalMs);
  res.json({ status: 'started', rps: state.rps, targetUrl: state.targetUrl });
});

app.post('/api/stop', (req, res) => {
  if (state.intervalId) clearInterval(state.intervalId);
  state.running = false;
  res.json({ status: 'stopped', sent: state.sent, errors: state.errors });
});

app.get('/api/status', (req, res) => {
  res.json({
    running: state.running,
    rps: state.rps,
    sent: state.sent,
    errors: state.errors,
    targetUrl: state.targetUrl
  });
});

app.listen(8200, () => console.log('Test app running at http://localhost:8200'));
