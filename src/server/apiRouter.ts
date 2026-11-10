/**
 * Central API Router Orchestrator
 * ZiGame 2.0 Defense-in-Depth Modular Architecture
 *
 * Mounts domain-isolated routers behind a unified authentication and
 * schema-validated security perimeter.
 */

import { Router } from 'express';
import { authenticateToken } from './authMiddleware';
import { systemRoutes } from './routes/systemRoutes';
import { sessionRoutes } from './routes/sessionRoutes';
import { economyRoutes } from './routes/economyRoutes';
import { competitiveRoutes } from './routes/competitiveRoutes';
import { adminRoutes } from './routes/adminRoutes';

export const apiRouter = Router();

// Global authentication parser (attaches verified req.user when Bearer token or test headers are present)
apiRouter.use(authenticateToken);

// Mount isolated domain routers
apiRouter.use(systemRoutes);
apiRouter.use(sessionRoutes);
apiRouter.use(economyRoutes);
apiRouter.use(competitiveRoutes);
apiRouter.use(adminRoutes);
