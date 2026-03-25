const { Pool } = require('pg');

const con = new Pool({
    host: process.env.DBHOST || 'localhost',
    user: process.env.DBUSER || 'chat_score',
    password: process.env.DBPASS || 'postgrespassword',
    database: process.env.DBNAME || 'chat_score_pg',
    port: process.env.DBPORT || 5432,
    max: parseInt(process.env.DBPOOL_MAX || '30', 10),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: parseInt(process.env.DBPOOL_TIMEOUT || '5000', 10),
});

module.exports = con