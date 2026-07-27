// src/config/database.js

require("dotenv").config();
const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on("connect", () => {
  console.log("✅ Conexión a PostgreSQL establecida.");
});

pool.on("error", (err) => {
  console.error("❌ Error en PostgreSQL:", err.message);
});

module.exports = pool;