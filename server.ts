import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy endpoint to avoid CORS issues
  app.post('/api/proxy', async (req, res) => {
    const { url, method, headers, body } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return res.status(400).json({ error: 'URL must start with http:// or https://' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000); // 60 second timeout

    try {
      const response = await fetch(url, {
        method: method || 'GET',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal as any
      });

      clearTimeout(timeout);

      // Handle streaming responses
      if (response.headers.get('content-type')?.includes('text/event-stream')) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        
        if (!response.body) {
          res.end();
          return;
        }

        // Handle both Node streams and Web streams
        if (typeof (response.body as any).on === 'function') {
          // Node stream (node-fetch)
          (response.body as any).on('data', (chunk: any) => {
            res.write(chunk);
          });
          
          (response.body as any).on('end', () => {
            res.end();
          });
          
          (response.body as any).on('error', (err: any) => {
            console.error('Stream error:', err);
            res.end();
          });
        } else {
          // Web stream (native fetch)
          const reader = (response.body as any).getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              res.write(value);
            }
          } catch (err) {
            console.error('Web stream error:', err);
          } finally {
            res.end();
          }
        }
      } else {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('application/json')) {
          const data = await response.json();
          res.status(response.status).json(data);
        } else {
          const text = await response.text();
          res.status(response.status).send(text);
        }
      }
    } catch (error: any) {
      clearTimeout(timeout);
      console.error('Proxy error:', error);
      const message = error.name === 'AbortError' ? 'Request timed out' : error.message;
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
