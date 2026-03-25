/**
 * Script de migracao: useMultiFileAuthState (filesystem) → PostgreSQL
 *
 * Copia todas as sessoes existentes do diretorio sessions/ para a tabela baileys_auth.
 * Pode ser executado com: docker exec chat_score_backend node database/migrateAuthToPostgres.js
 *
 * Seguro para rodar multiplas vezes (usa UPSERT).
 */

const fs = require('fs');
const path = require('path');
const { query } = require('./dbpromise');

async function migrate() {
    const sessionsDir = path.join(process.cwd(), 'sessions');

    if (!fs.existsSync(sessionsDir)) {
        console.log('Diretorio sessions/ nao encontrado. Nada a migrar.');
        return;
    }

    const dirs = fs.readdirSync(sessionsDir).filter(
        f => f.startsWith('md_') && f.endsWith('.json') && fs.statSync(path.join(sessionsDir, f)).isDirectory()
    );

    if (dirs.length === 0) {
        console.log('Nenhuma sessao encontrada para migrar.');
        return;
    }

    console.log(`Encontradas ${dirs.length} sessao(oes) para migrar.\n`);

    let totalKeys = 0;
    let errors = 0;

    for (const dir of dirs) {
        // Extrair sessionId do nome do diretorio: md_<sessionId>.json → sessionId
        const sessionId = dir.replace(/^md_/, '').replace(/\.json$/, '');
        const sessionPath = path.join(sessionsDir, dir);

        console.log(`Migrando sessao: ${sessionId.substring(0, 40)}...`);

        const files = fs.readdirSync(sessionPath).filter(f => f.endsWith('.json'));

        for (const file of files) {
            try {
                const filePath = path.join(sessionPath, file);
                const content = fs.readFileSync(filePath, 'utf-8');
                const parsed = JSON.parse(content);

                // Determinar key_type e key_id a partir do nome do arquivo
                let keyType, keyId;

                if (file === 'creds.json') {
                    keyType = 'creds';
                    keyId = '';
                } else {
                    // Formato: <type>-<id>.json, ex: pre-key-1.json, app-state-sync-key-AAAAALQ0.json
                    const nameWithoutExt = file.replace('.json', '');

                    // Encontrar o ultimo hifen que separa tipo do ID
                    // pre-key-1 → type=pre-key, id=1
                    // app-state-sync-key-AAAAALQ0 → type=app-state-sync-key, id=AAAAALQ0
                    // session-556799222377:44@s.whatsapp.net → type=session, id=556799222377:44@s.whatsapp.net

                    const lastHyphen = nameWithoutExt.lastIndexOf('-');
                    if (lastHyphen > 0) {
                        keyType = nameWithoutExt.substring(0, lastHyphen);
                        keyId = nameWithoutExt.substring(lastHyphen + 1);
                    } else {
                        keyType = nameWithoutExt;
                        keyId = '';
                    }
                }

                const serialized = JSON.stringify(parsed);

                await query(
                    `INSERT INTO baileys_auth (session_id, key_type, key_id, value, updated_at)
                     VALUES (?, ?, ?, ?::jsonb, CURRENT_TIMESTAMP)
                     ON CONFLICT (session_id, key_type, key_id)
                     DO UPDATE SET value = ?::jsonb, updated_at = CURRENT_TIMESTAMP`,
                    [sessionId, keyType, keyId, serialized, serialized]
                );

                totalKeys++;
            } catch (err) {
                errors++;
                console.error(`  ERRO ao migrar ${file}: ${err.message}`);
            }
        }

        console.log(`  ${files.length} arquivos processados`);
    }

    console.log(`\n=== Migracao concluida ===`);
    console.log(`Total de chaves migradas: ${totalKeys}`);
    console.log(`Erros: ${errors}`);
    console.log(`\nPara ativar o auth state PostgreSQL, defina AUTH_STATE_STORE=postgres no .env ou docker-compose.yml`);

    process.exit(0);
}

migrate().catch(err => {
    console.error('Erro fatal na migracao:', err);
    process.exit(1);
});
