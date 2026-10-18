import { pgPool, query as pgQuery } from '../config/postgres.js';

export const query = pgQuery;

export const getClient = () => {
  return pgPool.connect();
};

export default pgPool;

