const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  port: 5432,
});

async function debug() {
  try {
    const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'user'
      ORDER BY ordinal_position;
    `);
    console.log('Columns for table "user":');
    res.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`);
    });
    
    const userRes = await pool.query('SELECT email, password FROM "user"');
    console.log('\nUsers in database:');
    userRes.rows.forEach(row => {
        console.log(`- ${row.email}: ${row.password.substring(0, 10)}...`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

debug();
