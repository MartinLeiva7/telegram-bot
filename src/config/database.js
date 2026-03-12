const { Pool } = require("pg");

// Usamos la variable de entorno que definimos en el docker-compose
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Log para confirmar que la conexión es exitosa
pool.on("connect", () => {
  console.log("[DB] Cliente conectado a PostgreSQL");
});

pool.on("error", (err) => {
  console.error("[DB] Error inesperado en el cliente de Postgres", err);
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};