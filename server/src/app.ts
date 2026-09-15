import express, { Express } from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createDatabase } from './db/database.js';
import { initializeSchema } from './db/schema.js';
import { seedDatabase } from './db/seed.js';
import { findPackageDir } from './lib/repoPaths.js';

import { ExperimentRepository } from './repositories/experiment.repository.js';
import { FunnelRepository } from './repositories/funnel.repository.js';
import { CustomerRepository } from './repositories/customer.repository.js';
import { PaymentRepository } from './repositories/payment.repository.js';

import { ExperimentService } from './services/experiment.service.js';
import { FunnelService } from './services/funnel.service.js';
import { CustomerService } from './services/customer.service.js';
import { PaymentService } from './services/payment.service.js';

import { ExperimentController } from './controllers/experiment.controller.js';
import { FunnelController } from './controllers/funnel.controller.js';
import { CustomerController } from './controllers/customer.controller.js';
import { PaymentController } from './controllers/payment.controller.js';

import { createHealthRoutes } from './routes/health.routes.js';
import { createExperimentRoutes } from './routes/experiment.routes.js';
import { createFunnelRoutes } from './routes/funnel.routes.js';
import { createPaymentRoutes } from './routes/payment.routes.js';
import { createCustomerRoutes } from './routes/customer.routes.js';
import { errorHandler } from './middleware/error.middleware.js';

export interface AppContext {
  app: Express;
  db: DatabaseSync;
  expService: ExperimentService;
  funnelService: FunnelService;
  customerService: CustomerService;
  paymentService: PaymentService;
}

export function createApp(dbPath?: string, shouldSeed = true): AppContext {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const db = createDatabase(dbPath);
  initializeSchema(db);
  if (shouldSeed) {
    seedDatabase(db);
  }

  // Repositories
  const expRepo = new ExperimentRepository(db);
  const funnelRepo = new FunnelRepository(db);
  const customerRepo = new CustomerRepository(db);
  const paymentRepo = new PaymentRepository(db);

  // Services
  const expService = new ExperimentService(expRepo);
  const funnelService = new FunnelService(funnelRepo);
  const customerService = new CustomerService(customerRepo);
  const paymentService = new PaymentService(paymentRepo, customerRepo, funnelRepo);

  // Controllers
  const expController = new ExperimentController(expService);
  const funnelController = new FunnelController(funnelService);
  const customerController = new CustomerController(customerService);
  const paymentController = new PaymentController(paymentService);

  // Mount routes
  app.use('/api', createHealthRoutes());
  app.use('/api', createExperimentRoutes(expController));
  app.use('/api', createFunnelRoutes(funnelController));
  app.use('/api', createPaymentRoutes(paymentController));
  app.use('/api', createCustomerRoutes(customerController));

  // No route above matched: reply with a plain 404 instead of falling
  // through to the SPA fallback below and returning index.html for a bad
  // API path.
  app.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'Not found' });
  });

  // Serve the built client (client/dist) if present, so the same container
  // that runs the API also serves the dashboard. Resolved by package
  // identity rather than a fixed relative depth, since this file's own
  // directory depth differs between `tsx` (dev, server/src/) and the
  // compiled build (server/dist/server/src/, see server/tsconfig.json).
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRootDir = findPackageDir(__dirname, 'craftfunnel');
  const clientDistPath = path.resolve(repoRootDir, 'client', 'dist');
  if (fs.existsSync(clientDistPath)) {
    app.use(express.static(clientDistPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(clientDistPath, 'index.html'));
    });
  }

  app.use(errorHandler);

  return {
    app,
    db,
    expService,
    funnelService,
    customerService,
    paymentService,
  };
}
