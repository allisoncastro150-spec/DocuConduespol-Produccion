const pool = require("../config/database");

async function getAll() {

  const result = await pool.query(`
    SELECT
      u.id,
      u.username,
      u.role,
      COALESCE(d.name,'TODOS') AS department,
      u.is_active AS active
    FROM users u
    LEFT JOIN departments d
      ON d.id = u.department_id
    ORDER BY u.username;
  `);

  return result.rows;
}

async function findByUsername(username) {

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.username,
      u.password_hash AS "passwordHash",
      u.role,
      u.is_active AS "active",
      COALESCE(d.name,'TODOS') AS department
    FROM users u
    LEFT JOIN departments d
      ON d.id = u.department_id
    WHERE u.username = $1
    LIMIT 1;
    `,
    [username]
  );

  return result.rows[0] || null;
}

async function create(user){

  let departmentId = null;

  if(user.role !== "admin"){

    const dep = await pool.query(
      `
      SELECT id
      FROM departments
      WHERE name = $1
      `,
      [user.department]
    );

    if(dep.rows.length === 0){
      throw new Error("Departamento no encontrado.");
    }

    departmentId = dep.rows[0].id;

  }

  await pool.query(
    `
    INSERT INTO users
    (
      username,
      password_hash,
      role,
      department_id,
      is_active
    )
    VALUES
    (
      $1,
      $2,
      $3,
      $4,
      TRUE
    )
    `,
    [
      user.username,
      user.passwordHash,
      user.role,
      departmentId
    ]
  );

}

async function deleteByUsername(username){

    await pool.query(
      `
      DELETE FROM users
      WHERE username=$1
      `,
      [username]
    );

}

module.exports = {
  getAll,
  findByUsername,
  create,
  deleteByUsername
};