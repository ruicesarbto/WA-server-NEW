const con = require('./config')
let queryDepth = 0;
const MAX_DEPTH = 100;

/**
 * Converte placeholders do estilo MySQL (?) para o estilo PostgreSQL ($1, $2, ...)
 * E trata o padrão IN (?) para usar ANY($1).
 */
function translateSql(sql, params) {
    let index = 1;
    let finalParams = Array.isArray(params) ? [...params] : [params];
    
    // 1. Converter ? para $1, $2, etc.
    let processedSql = sql.replace(/\?/g, () => `$${index++}`);

    // 2. Tratar palavra reservada 'user' (Postgres exige "user")
    // Substitui apenas se for a palavra 'user' isolada (não parte de outra palavra)
    processedSql = processedSql.replace(/\buser\b/gi, '"user"');

    // 2. Pós-processamento para trocar IN ($n) por = ANY($n) se o parâmetro for array
    // Isso é necessário porque o driver 'pg' não expande arrays automaticamente como o 'mysql2'
    processedSql = processedSql.replace(/IN\s?\((\$\d+)\)/gi, (match, grp) => {
        const paramIdx = parseInt(grp.substring(1));
        if (Array.isArray(finalParams[paramIdx - 1])) {
            return `= ANY(${grp})`;
        }
        return match;
    });

    return { sql: processedSql, params: finalParams };
}

async function query(sql, arr = []) {
    queryDepth++;

    // Prevent infinite recursion
    if (queryDepth > MAX_DEPTH) {
        queryDepth--;
        throw new Error('Query depth exceeded - possible infinite recursion detected');
    }

    try {
        if (!sql) {
            queryDepth--;
            return "No sql provided"
        }

        const { sql: finalSql, params: finalParams } = translateSql(sql, arr);

        const result = await con.query(finalSql, finalParams);
        
        // PostgreSQL retorna o array de objetos em .rows
        // Retornamos apenas .rows para compatibilidade com o código original (que esperava array de objetos)
        return result.rows;
    } catch (err) {
        console.error('[DB Error]', err.message, '| SQL:', sql);
        throw err;
    } finally {
        queryDepth--;
    }
}

exports.query = query   
