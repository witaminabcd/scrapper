const request = require('request-promise');

const torProxy = 'socks5://127.0.0.1:9050'; // стандартный порт Tor

async function downloadImageWithTor(url, filename) {
    const options = {
        url,
        encoding: null,
        proxy: torProxy,
        timeout: CONFIG.REQUEST_TIMEOUT
    };

    try {
        const body = await request(options);
        await fs.writeFile(path.join(CONFIG.IMG_DIR, filename), body);
        return true;
    } catch (err) {
        console.error('Error downloading with Tor:', err);
        return false;
    }
}

// Функция для смены IP через Tor Control Port
async function renewTorIP() {
    try {
        const controlPort = 9051; // стандартный порт управления Tor
        const auth = ''; // если установлен пароль

        const options = {
            method: 'POST',
            url: `http://localhost:${controlPort}`,
            headers: {
                'Content-Length': '0'
            },
            body: 'AUTHENTICATE "' + auth + '"\r\nSIGNAL NEWNYM\r\n',
            proxy: torProxy
        };

        await request(options);
        console.log('Tor IP address changed successfully');
        return true;
    } catch (err) {
        console.error('Error changing Tor IP:', err);
        return false;
    }
}

renewTorIP();