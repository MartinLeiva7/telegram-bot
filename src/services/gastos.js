const { doc } = require("../config/excel");
const db = require("../config/database"); // Importamos el nuevo servicio

async function guardarGasto(datos) {
  try {
    // 1. Guardar en Google Sheets (lo que ya tenías)
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const montoFormateado = Number(datos.gasto.monto).toFixed(2).replace(".", ",");

    await sheet.addRow({
      Fecha: new Date().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }),
      Monto: montoFormateado,
      Concepto: datos.gasto.concepto,
      Categoria: datos.categoria,
      Link_Foto: datos.gasto.driveUrl || "Manual",
    });

    // 2. Guardar en PostgreSQL (Lo nuevo)
    const query = `
      INSERT INTO gastos (monto, concepto, categoria, link_foto)
      VALUES ($1, $2, $3, $4)
    `;
    const valores = [
      datos.gasto.monto,
      datos.gasto.concepto,
      datos.categoria,
      datos.gasto.driveUrl || "Manual"
    ];

    await db.query(query, valores);
    console.log(`[DB] Gasto guardado en Postgres: ${datos.gasto.concepto}`);

    return true;
  } catch (error) {
    console.error("Error al guardar el gasto:", error);
    throw error;
  }
}

module.exports = { guardarGasto };