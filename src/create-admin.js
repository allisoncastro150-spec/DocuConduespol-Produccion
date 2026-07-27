require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./config/database");

async function main() {
  try {
    const passwordHash = await bcrypt.hash("admin2026", 10);

    await pool.query(
      `
      INSERT INTO users
      (username,password_hash,role,department_id,must_change_password,is_active)
      VALUES
      ($1,$2,'admin',NULL,false,true)
      ON CONFLICT (username) DO NOTHING
    `,
      ["admin", passwordHash]
    );

    console.log("✅ Administrador creado correctamente.");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();