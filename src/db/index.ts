import { FinanceDB } from './db';

export const db = new FinanceDB();
export { ensureBaseCategories, ensureSettings, SCHEMA_VERSION } from './db';
