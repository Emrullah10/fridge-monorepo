const mapRow = (row) => row && ({
  id: row.id,
  email: row.email,
  passwordHash: row.password_hash,
  displayName: row.display_name,
  locale: row.locale,
});

const makeUserRepository = ({ rawQuery }) => {
  return {
    findByEmail: async (email) => {
      const { rows } = await rawQuery('SELECT * FROM app_user WHERE email = $1', [email]);
      return mapRow(rows[0]);
    },

    findById: async (id) => {
      const { rows } = await rawQuery('SELECT * FROM app_user WHERE id = $1', [id]);
      return mapRow(rows[0]);
    },

    create: async ({ email, passwordHash, displayName, locale }) => {
      const { rows } = await rawQuery(
        `INSERT INTO app_user (email, password_hash, display_name, locale)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [email, passwordHash, displayName, locale],
      );
      return mapRow(rows[0]);
    },

    deleteById: async (id) => {
      await rawQuery('DELETE FROM app_user WHERE id = $1', [id]);
    },
  };
};

export { makeUserRepository };
