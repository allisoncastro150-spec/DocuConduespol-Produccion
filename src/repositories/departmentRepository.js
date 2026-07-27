const pool = require("../config/database");

async function getAll() {
  const result = await pool.query(
    `
    SELECT
        id,
        name,
        code
    FROM departments
    ORDER BY name;
    `
  );

  return result.rows;
}

async function findByName(name) {
  const result = await pool.query(
    "SELECT * FROM departments WHERE name = $1",
    [name]
  );

  return result.rows[0];
}

module.exports = {
  getAll,
  findByName,
};