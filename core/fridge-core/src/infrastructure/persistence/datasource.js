import pg from 'pg';

const { Pool } = pg;

const makeDatasource = ({ connectionString }) => {
  const pool = new Pool({ connectionString });

  const query = (text, params) => pool.query(text, params);

  const withTransaction = async (fn) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn({ query: (text, params) => client.query(text, params) });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };

  const close = () => pool.end();

  return { query, withTransaction, close };
};

export { makeDatasource };
