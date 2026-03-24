const { Pool } = require('pg');

const con = new Pool({
    host: process.env.DBHOST || 'localhost',
    user: process.env.DBUSER || 'chat_score',
    password: process.env.DBPASS || 'postgrespassword',
    database: process.env.DBNAME || 'chat_score_pg',
    port: process.env.DBPORT || 5432,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

module.exports = con