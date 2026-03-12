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

module.exports = { guardarGasto };
