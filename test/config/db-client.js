import pg from 'pg';

const { Pool } = pg;

// Integration testleri gerçek Postgres'e karşı çalışır (mock yok — bilinçli
// tercih, bkz. monorepo şablonu §9.1). DATABASE_URL .env'den veya CI'da
// export edilmiş olmalı.
let pool;

const getTestPool = () => {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL gerekli — integration testleri gerçek Postgres ister.');
    }
    pool = new Pool({ connectionString });
  }
  return pool;
};

const rawQuery = (text, params) => getTestPool().query(text, params);

const closeTestPool = async () => {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
};

export { getTestPool, rawQuery, closeTestPool };
