import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import type { Router } from 'express';

import { QueueManager } from './QueueManager';

const DEFAULT_BULL_BOARD_BASE_PATH = '/admin/background-jobs';

/** Exposes framework queues through Bull Board for operational monitoring. */
export class BullBoardManager {
  private readonly serverAdapter = new ExpressAdapter();

  private readonly basePath: string;

  public constructor(
    private readonly queueManager: QueueManager = QueueManager.getInstance(),
    basePath: string = DEFAULT_BULL_BOARD_BASE_PATH,
  ) {
    this.basePath = basePath;
    this.serverAdapter.setBasePath(basePath);
  }

  public initialize(): void {
    const queueAdapters = this.queueManager
      .getAllFrameworkQueues()
      .map((queue) => new BullMQAdapter(queue));

    createBullBoard({
      queues: queueAdapters,
      serverAdapter: this.serverAdapter,
    });
  }

  public getRouter(): Router {
    return this.serverAdapter.getRouter();
  }

  public getBasePath(): string {
    return this.basePath;
  }
}
