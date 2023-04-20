import fs from 'fs';

import { ItemImportIntent } from '@proton/pass/types';

import { readChromeData } from './chrome.reader';

describe('Import Chrome CSV', () => {
    let chromeExport: string;
    let chromeExportWindows: string;

    beforeAll(async () => {
        chromeExport = await fs.promises.readFile(__dirname + '/mocks/chrome.csv', 'utf8');
        chromeExportWindows = await fs.promises.readFile(__dirname + '/mocks/chrome-windows.csv', 'utf8');
    });

    it('should handle corrupted files', async () => {
        await expect(readChromeData('not-a-csv-file')).rejects.toThrow();
    });

    it('transforms chrome csv into ImportPayload', async () => {
        const payload = await readChromeData(chromeExport);
        const [vaultData] = payload;

        expect(payload.length).toEqual(1);
        expect(vaultData.type).toEqual('new');
        expect(vaultData.type === 'new' && vaultData.vaultName).not.toBeUndefined();

        const { items } = vaultData;

        /* Login */
        const loginItem1 = items[0] as ItemImportIntent<'login'>;
        expect(loginItem1.type).toEqual('login');
        expect(loginItem1.metadata.name).toEqual('proton.me');
        expect(loginItem1.metadata.note).toEqual('');
        expect(loginItem1.content.username).toEqual('nobody@proton.me');
        expect(loginItem1.content.password).toEqual('proton123');
        expect(loginItem1.content.urls[0]).toEqual('https://account.proton.me');

        /* Login */
        const loginItem2 = items[1] as ItemImportIntent<'login'>;
        expect(loginItem2.type).toEqual('login');
        expect(loginItem2.metadata.name).toEqual('missing url');
        expect(loginItem2.metadata.note).toEqual('');
        expect(loginItem2.content.username).toEqual('missingurl@proton.me');
        expect(loginItem2.content.password).toEqual('proton123');
        expect(loginItem2.content.urls).toStrictEqual([]);

        /* Login */
        const loginItem3 = items[2] as ItemImportIntent<'login'>;
        expect(loginItem3.type).toEqual('login');
        expect(loginItem3.metadata.name).toEqual('missing password');
        expect(loginItem3.metadata.note).toEqual('');
        expect(loginItem3.content.username).toEqual('missingpw@proton.me');
        expect(loginItem3.content.password).toEqual('');
        expect(loginItem3.content.urls[0]).toEqual('https://account.proton.me');
    });

    it('transforms chrome csv (windows) into ImportPayload', async () => {
        const payload = await readChromeData(chromeExportWindows);
        const [vaultData] = payload;

        expect(payload.length).toEqual(1);
        expect(vaultData.type).toEqual('new');
        expect(vaultData.type === 'new' && vaultData.vaultName).not.toBeUndefined();

        const { items } = vaultData;

        /* Login */
        const loginItem1 = items[0] as ItemImportIntent<'login'>;
        expect(loginItem1.type).toEqual('login');
        expect(loginItem1.metadata.name).toEqual('proton.me');
        expect(loginItem1.metadata.note).toEqual('');
        expect(loginItem1.content.username).toEqual('nobody@proton.me');
        expect(loginItem1.content.password).toEqual('proton123');
        expect(loginItem1.content.urls[0]).toEqual('https://account.proton.me');

        /* Login */
        const loginItem2 = items[1] as ItemImportIntent<'login'>;
        expect(loginItem2.type).toEqual('login');
        expect(loginItem2.metadata.name).toEqual('missing url');
        expect(loginItem2.metadata.note).toEqual('');
        expect(loginItem2.content.username).toEqual('missingurl@proton.me');
        expect(loginItem2.content.password).toEqual('proton123');
        expect(loginItem2.content.urls).toStrictEqual([]);

        /* Login */
        const loginItem3 = items[2] as ItemImportIntent<'login'>;
        expect(loginItem3.type).toEqual('login');
        expect(loginItem3.metadata.name).toEqual('missing password');
        expect(loginItem3.metadata.note).toEqual('');
        expect(loginItem3.content.username).toEqual('missingpw@proton.me');
        expect(loginItem3.content.password).toEqual('');
        expect(loginItem3.content.urls[0]).toEqual('https://account.proton.me');
    });
});
