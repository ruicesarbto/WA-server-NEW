const { Client } = require('pg');
require('dotenv').config();

const client = new Client({
  host: '127.0.0.1',
  port: 5432,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
});

async function test() {
  try {
    console.log('Tentando conectar a 127.0.0.1:5432...');
    await client.connect();
    console.log('✅ Conectado com sucesso!');
    const res = await client.query('SELECT NOW()');
    console.log('Resultado:', res.rows[0]);
    await client.end();
  } catch (err) {
    console.error('❌ Erro de conexão:', err.message);
    process.exit(1);
  }
}

test();
