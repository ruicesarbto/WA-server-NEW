const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DBHOST,
  user: process.env.DBUSER,
  password: process.env.DBPASS,
  database: process.env.DBNAME,
  port: 5432,
});

async function setup() {
  try {
    const pass = await bcrypt.hash('123', 10);
    const everythingPlan = JSON.stringify({"id":5,"title":"Everything","price":"39","price_crosed":"3999","days":"39","des":"this plan has everything","phonebook_contact_limit":"399","allow_chat_tags":1,"allow_chat_note":1,"chatbot":1,"api_access":1,"wa_account":"10","wa_warmer":1,"createdAt":"2024-05-06T03:41:11.000Z"});

    // 0. Insert Plans
    console.log('Setting up plans...');
    await pool.query(`
      INSERT INTO plan (id, title, price, price_crosed, days, des, phonebook_contact_limit, allow_chat_tags, allow_chat_note, chatbot, api_access, wa_account, wa_warmer)
      VALUES 
      (5, 'Everything', '39', '3999', '39', 'this plan has everything', '399', 1, 1, 1, 1, '10', 1),
      (6, 'Trial', '0', '0', '10', 'This is a trial plan', '999', 1, 1, 1, 1, '99', 1),
      (7, 'Basic', '19', '99', '30', 'this is a basic plan', '99', 1, 1, 1, 1, '1', 1)
      ON CONFLICT DO NOTHING
    `);

    // 1. Insert Admin
    console.log('Setting up admin@admin.com...');
    await pool.query(`
      INSERT INTO "user" (uid, role, name, email, mobile, password, token, trial, plan, plan_expire)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
    `, ['5QnEKMP7lbzObMlLJNAxdcIhNb4qYIQBX', 'admin', 'Admin', 'admin@admin.com', '0000000000', pass, '', 1, everythingPlan, '2524608000000']);

    await pool.query(`
      INSERT INTO admin (uid, email, password, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT DO NOTHING
    `, ['5QnEKMP7lbzObMlLJNAxdcIhNb4qYIQBX', 'admin@admin.com', pass, 'admin']);

    // 2. Insert User
    console.log('Setting up user@user.com...');
    await pool.query(`
      INSERT INTO "user" (uid, role, name, email, mobile, password, token, trial, plan, plan_expire)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT DO NOTHING
    `, ['NAxdcIhNb4qYIQBXweRz2t7gwWxveFEi', 'user', 'User', 'user@user.com', '91888378782', pass, '', 1, everythingPlan, '2524608000000']);
    
    // Explicitly update just in case they existed but with wrong pass
    await pool.query('UPDATE "user" SET password = $1 WHERE email = $2', [pass, 'admin@admin.com']);
    await pool.query('UPDATE "user" SET password = $1 WHERE email = $2', [pass, 'user@user.com']);
    await pool.query('UPDATE admin SET password = $1 WHERE email = $2', [pass, 'admin@admin.com']);

    console.log('Users setup completed with password: 123');

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await pool.end();
  }
}

setup();
