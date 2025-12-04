import express from 'express';
import { createServer as createViteServer } from 'vite';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import aiRoutes from './routes/ai';
import prospectsRoutes from './routes/prospects';
import notificationsRoutes from './routes/notifications';

const app = express();
const PORT = process.env.PORT || 5000;

async function startServer() {
  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }));

  // CORS - allow all origins for development
  app.use(cors({
    origin: true,
    credentials: true,
  }));

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression());

  // Logging
  app.use(morgan('dev'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  });

  // API routes
  app.use('/api/ai', aiRoutes);
  app.use('/api/prospects', prospectsRoutes);
  app.use('/api/notifications', notificationsRoutes);

  // In development, set up Vite dev server
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  
  app.use(vite.middlewares);

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://0.0.0.0:${PORT}`);
    console.log(`📊 Database connected`);
    console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🎨 Vite dev server integrated`);
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
