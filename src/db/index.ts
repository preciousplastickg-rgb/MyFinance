import { FinanceDB } from './db';

export const db = new FinanceDB();
export { ensureBaseAreas, ensureBaseCategories, ensureSettings, SCHEMA_VERSION } from './db';
