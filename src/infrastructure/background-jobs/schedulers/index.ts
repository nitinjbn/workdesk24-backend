import { registerMaintenanceSchedulers } from './maintenance.scheduler';

export async function registerAllSchedulers(): Promise<void> {
  await registerMaintenanceSchedulers();
}