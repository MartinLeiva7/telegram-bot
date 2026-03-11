const { GoogleSpreadsheet } = require("google-spreadsheet");
const { JWT } = require("google-auth-library");

// Extraemos las variables de entorno
const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_JSON_KEY);

// Configuramos la autenticación una sola vez
const serviceAccountAuth = new JWT({
  email: GOOGLE_CREDS.client_email,
  key: GOOGLE_CREDS.private_key,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

// Exportamos el objeto 'doc' para que otros archivos lo usen
module.exports = { doc };