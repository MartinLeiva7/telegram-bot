const { doc } = require("../config/excel");
const db = require("../config/database");

async function guardarGasto(datos) {
  // datos contiene: { userId, categoria, gasto: { monto, concepto, driveUrl } }
  const infoGasto = datos.gasto;

  if (!infoGasto) {
    throw new Error("No se encontró la información del gasto temporal.");
  }

  try {
    // 1. Google Sheets
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    const montoFormateado = Number(infoGasto.monto)
      .toFixed(2)
      .replace(".", ",");

    await sheet.addRow({
      Fecha: new Date().toLocaleString("es-AR", {
        timeZone: "America/Argentina/Buenos_Aires",
      }),
      Monto: montoFormateado,
      Concepto: infoGasto.concepto,
      Categoria: datos.categoria,
      Link_Foto: infoGasto.driveUrl || "Manual",
    });

    // 2. PostgreSQL
    const query = `
      INSERT INTO gastos (monto, concepto, categoria, link_foto)
      VALUES ($1, $2, $3, $4)
    `;
    const valores = [
      parseFloat(infoGasto.monto), // Aseguramos que sea número para la DB
      infoGasto.concepto,
      datos.categoria,
      infoGasto.driveUrl || "Manual",
    ];

    await db.query(query, valores);
    console.log(`[DB] Gasto guardado exitosamente: ${infoGasto.concepto}`);

    return true;
  } catch (error) {
    console.error("Error detallado en guardarGasto:", error);
    throw error;
  }
}

async function obtenerTotalGastos() {
  try {
    const query = "SELECT SUM(monto) as total FROM gastos";
    const resultado = await db.query(query);

    // El resultado de SUM puede venir como string o null si está vacía
    const total = resultado.rows[0].total || 0;
    return parseFloat(total).toFixed(2);
  } catch (error) {
    console.error("Error al obtener el total de la DB:", error);
    throw error;
  }
}

// No te olvides de exportarla al final del archivo
module.exports = { guardarGasto, obtenerTotalGastos };
