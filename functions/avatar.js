const axios = require('axios');
const fs = require('fs');
const path = require('path');

/**
 * Baixa uma imagem de uma URL e salva localmente.
 * @param {string} url - URL da imagem no CDN do WhatsApp.
 * @param {string} jid - ID do contato/grupo (usado para o nome do arquivo).
 * @returns {Promise<string|null>} - Retorna o caminho relativo do arquivo salvo ou null.
 */
async function downloadAndSaveAvatar(url, jid) {
    if (!url || !jid) return null;

    try {
        // Remove sufixos do JID para o nome do arquivo
        const cleanId = jid.split('@')[0].split(':')[0];
        const fileName = `${cleanId}.jpg`;
        const avatarsDir = path.join(__dirname, '..', 'public', 'media', 'avatars');
        const filePath = path.join(avatarsDir, fileName);

        // Garante que o diretório existe
        if (!fs.existsSync(avatarsDir)) {
            fs.mkdirSync(avatarsDir, { recursive: true });
        }

        const response = await axios({
            method: 'GET',
            url: url,
            responseType: 'stream',
            timeout: 10000
        });

        const writer = fs.createWriteStream(filePath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => resolve(`avatars/${fileName}`));
            writer.on('error', (err) => {
                console.error('[Avatar:Download] Writer error:', err.message);
                resolve(null);
            });
        });

    } catch (error) {
        console.error(`[Avatar:Download] Failed for ${jid}:`, error.message);
        return null;
    }
}

module.exports = { downloadAndSaveAvatar };
