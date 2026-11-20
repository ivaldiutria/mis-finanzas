import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = '0.0.0.0';

const distPath = path.resolve(__dirname, 'dist');
const indexPath = path.join(distPath, 'index.html');

// Endpoint de verificación de salud (health check) para Cloud Run
app.get('/health', (_req: Request, res: Response) => {
  res.status(200).send('OK');
});

// Servir archivos estáticos generados por Vite
if (fs.existsSync(distPath)) {
  app.use(
    express.static(distPath, {
      maxAge: '1d',
      etag: true,
    })
  );
}

// Fallback SPA para permitir recargas y rutas de la aplicación
app.get('*', (_req: Request, res: Response) => {
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(503).send('Aplicación en proceso de compilación. Por favor actualiza en unos momentos.');
  }
});

const server = app.listen(PORT, HOST, () => {
  console.log(`[Production Server] Listening on http://${HOST}:${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('[Production Server] SIGTERM received, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
