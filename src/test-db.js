const pool = require("./config/database");

async function testConnection() {
  try {
    const result = await pool.query("SELECT NOW() AS fecha");
    console.log("✅ PostgreSQL conectado");
    console.log(result.rows[0]);
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await pool.end();
  }
}

testConnection();
