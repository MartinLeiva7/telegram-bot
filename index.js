const { Telegraf } = require('telegraf');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

// 1. Cargar variables de entorno
const BOT_TOKEN = process.env.BOT_TOKEN;
const SHEET_ID = process.env.SHEET_ID;
// Para la clave de Google, la pasaremos como un string JSON
const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_JSON_KEY);

const serviceAccountAuth = new JWT({
  email: GOOGLE_CREDS.client_email,
  key: GOOGLE_CREDS.private_key,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);
const bot = new Telegraf(BOT_TOKEN);

async function registrarGasto(ctx, monto, concepto) {
  try {
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0]; // La primera pestaña
    
    await sheet.addRow({
      Fecha: new Date().toLocaleString('es-AR'), // Ajusta tu zona horaria
      Monto: monto,
      Concepto: concepto
    });
    
    await ctx.reply(`✅ Registrado: $${monto} en "${concepto}"`);
  } catch (error) {
    console.error(error);
    await ctx.reply('❌ Error al escribir en Google Sheets');
  }
}

// Escuchar mensajes de texto
bot.on('text', async (ctx) => {
  const mensaje = ctx.message.text;
  const partes = mensaje.split(' ');
  
  if (partes.length >= 2 && !isNaN(partes[0])) {
    const monto = partes[0];
    const concepto = partes.slice(1).join(' ');
    await registrarGasto(ctx, monto, concepto);
  } else {
    await ctx.reply('Usa el formato: [monto] [concepto]\nEjemplo: 1500 Almuerzo');
  }
});

bot.launch();
console.log('Bot en marcha...');

// Mini servidor para que Koyeb crea que es una web y pase el Health Check
const http = require('http');
http.createServer((req, res) => {
  res.writeHead(200);
  res.end('Bot vivo');
}).listen(process.env.PORT || 8000);