const con = require('./database/config');

async function checkSchema() {
    try {
        console.log('--- Scanning messages table ---');
        const res = await con.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'messages' 
            ORDER BY ordinal_position;
        `);
        console.table(res.rows);
        process.exit(0);
    } catch (err) {
        console.error('Error checking schema:', err.message);
        process.exit(1);
    }
}

checkSchema();
