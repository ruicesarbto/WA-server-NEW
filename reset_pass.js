const bcrypt = require('bcryptjs');
const { Client } = require('pg');
const dotenv = require('dotenv');
dotenv.config();

const client = new Client({
    user: process.env.DBUSER,
    host: process.env.DBHOST,
    database: process.env.DBNAME,
    password: process.env.DBPASS,
    port: process.env.DBPORT,
});

async function reset() {
    await client.connect();
    
    const adminPass = await bcrypt.hash('123', 10);
    const userPass = await bcrypt.hash('123', 10);
    
    console.log('Updating admin@admin.com...');
    await client.query('UPDATE "user" SET password = $1 WHERE email = $2', [adminPass, 'admin@admin.com']);
    await client.query('UPDATE admin SET password = $1 WHERE email = $2', [adminPass, 'admin@admin.com']);
    
    console.log('Updating user@user.com...');
    await client.query('UPDATE "user" SET password = $1 WHERE email = $2', [userPass, 'user@user.com']);
    
    await client.end();
    console.log('Passwords reset successfully.');
}

reset().catch(console.error);
