import { FinanceDB } from './db';

export const db = new FinanceDB();
export { ensureSettings, SCHEMA_VERSION } from './db';
