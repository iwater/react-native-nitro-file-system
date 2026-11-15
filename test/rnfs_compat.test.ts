describe('rnfs-compat layer', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('maps path constants and delegates file/directory/hash/disk operations correctly', async () => {
        const backing: Record<string, Buffer> = {
            '/doc/a.txt': Buffer.from('hello', 'utf8'),
        };

        const mockHybrid: any = {
            openFlagValues: [0, 1, 2, 512, 2048, 131072, 1024, 8, 1048576, -1, 256, 128, 4194304, 2097152, -1, 4],
            fileProtectionKeys: {},
            bundleUri: 'file:///app.app',
            cachesDirectoryPath: '/cache',
            documentDirectoryPath: '/doc',
            downloadDirectoryPath: '/dl',
            externalCachesDirectoryPath: '/ext-cache',
            externalDirectoryPath: '/ext',
            externalStorageDirectoryPath: '/ext-storage',
            libraryDirectoryPath: '/lib',
            mainBundlePath: '/app.app',
            picturesDirectoryPath: '/pics',
            temporaryDirectoryPath: '/tmp',
            lastErrno: 0,
            lastErrorCode: '',
            access: jest.fn((p: string) => {
                if (!(p in backing)) {
                    mockHybrid.lastErrno = 2;
                    mockHybrid.lastErrorCode = 'ENOENT';
                    throw new Error('ENOENT');
                }
            }),
            readFile: jest.fn((p: string) => {
                const buf = backing[p];
                return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
            }),
            writeFile: jest.fn((p: string, ab: ArrayBuffer) => {
                backing[p] = Buffer.from(ab);
            }),
            mkdir: jest.fn(),
            rm: jest.fn((p: string) => {
                delete backing[p];
            }),
            readdir: jest.fn(() => ['a.txt']),
            stat: jest.fn((p: string) => ({
                dev: 1,
                ino: 2,
                mode: p === '/doc/a.txt' ? 0o100644 : 0o040755,
                nlink: 1,
                uid: 0,
                gid: 0,
                rdev: 0,
                size: backing[p]?.length ?? 0,
                blksize: 4096,
                blocks: 1,
                atimeMs: 1000,
                mtimeMs: 2000,
                ctimeMs: 3000,
                birthtimeMs: 3000,
            })),
            copyFile: jest.fn((s: string, d: string) => {
                backing[d] = Buffer.from(backing[s]);
            }),
            rename: jest.fn((s: string) => {
                if (s === '/doc/exdev.txt') {
                    mockHybrid.lastErrno = 18;
                    mockHybrid.lastErrorCode = 'EXDEV';
                    throw new Error('EXDEV');
                }
            }),
            cp: jest.fn((s: string, d: string) => {
                backing[d] = Buffer.from(backing[s]);
            }),
            statfs: jest.fn(() => ({
                totalBytes: 9000,
                availableBytes: 3500,
                freeBytes: 4000,
                type: 1,
                bsize: 4096,
                blocks: 10,
                bfree: 5,
                bavail: 4,
                files: 100,
                ffree: 90,
            })),
            hashFile: jest.fn(async (_p: string, algo: string) => `hash-${algo}`),
        };

        jest.doMock('react-native-nitro-modules', () => ({
            NitroModules: { createHybridObject: () => mockHybrid },
        }));
        const unpooledBuffer = {
            from(value: any, encoding?: BufferEncoding) {
                if (typeof value === 'string') {
                    const tmp = globalThis.Buffer.from(value, encoding);
                    const ab = tmp.buffer.slice(tmp.byteOffset, tmp.byteOffset + tmp.byteLength);
                    return globalThis.Buffer.from(ab);
                }
                if (value instanceof ArrayBuffer) {
                    return globalThis.Buffer.from(value);
                }
                const view = value instanceof Uint8Array ? value : new Uint8Array(value);
                const ab = view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength);
                return globalThis.Buffer.from(ab);
            },
        };
        jest.doMock('react-native-nitro-buffer', () => ({
            Buffer: unpooledBuffer,
        }));

        const rnfs = require('../src/rnfs-compat');

        expect(rnfs.DocumentDirectoryPath).toBe('/doc');
        expect(rnfs.CachesDirectoryPath).toBe('/cache');
        expect(rnfs.TemporaryDirectoryPath).toBe('/tmp');
        expect(rnfs.MainBundlePath).toBe('/app.app');
        expect(rnfs.DownloadDirectoryPath).toBe('/dl');
        expect(rnfs.ExternalDirectoryPath).toBe('/ext');

        expect(await rnfs.exists('/doc/a.txt')).toBe(true);
        expect(await rnfs.exists('/doc/missing.txt')).toBe(false);
        expect(await rnfs.readFile('/doc/a.txt', 'utf8')).toBe('hello');
        expect(await rnfs.readFile('/doc/a.txt', 'base64')).toBe(Buffer.from('hello').toString('base64'));

        await rnfs.writeFile('/doc/b.txt', 'world', 'utf8');
        expect(backing['/doc/b.txt'].toString('utf8')).toBe('world');

        await rnfs.mkdir('/doc/sub');
        expect(mockHybrid.mkdir).toHaveBeenCalledWith('/doc/sub', 0o777, true);

        const entries = await rnfs.readDir('/doc');
        expect(entries).toHaveLength(1);
        expect(entries[0].name).toBe('a.txt');
        expect(entries[0].path).toBe('/doc/a.txt');
        expect(entries[0].isFile()).toBe(true);

        const st = await rnfs.stat('/doc/a.txt');
        expect(st.size).toBe(5);
        expect(st.originalFilepath).toBe('/doc/a.txt');
        expect(st.isFile()).toBe(true);

        await rnfs.copyFile('/doc/a.txt', '/doc/copy.txt');
        expect(backing['/doc/copy.txt'].toString('utf8')).toBe('hello');

        // copyFileAssets & existsAssets
        backing['asset://fonts/custom.ttf'] = Buffer.from('asset-data', 'utf8');
        expect(await rnfs.existsAssets('fonts/custom.ttf')).toBe(true);
        expect(await rnfs.existsAssets('/fonts/custom.ttf')).toBe(true);
        expect(await rnfs.existsAssets('fonts/missing.ttf')).toBe(false);

        await rnfs.copyFileAssets('fonts/custom.ttf', '/doc/font.ttf');
        expect(mockHybrid.copyFile).toHaveBeenCalledWith('asset://fonts/custom.ttf', '/doc/font.ttf', 0);
        expect(backing['/doc/font.ttf'].toString('utf8')).toBe('asset-data');

        await rnfs.copyFileAssets('/fonts/custom.ttf', '/doc/font2.ttf');
        expect(mockHybrid.copyFile).toHaveBeenCalledWith('asset://fonts/custom.ttf', '/doc/font2.ttf', 0);
        expect(backing['/doc/font2.ttf'].toString('utf8')).toBe('asset-data');

        // EXDEV rename fallback -> cp + rm
        backing['/doc/exdev.txt'] = Buffer.from('cross', 'utf8');
        await rnfs.moveFile('/doc/exdev.txt', '/doc/moved.txt');
        expect(mockHybrid.cp).toHaveBeenCalled();
        expect(backing['/doc/moved.txt'].toString('utf8')).toBe('cross');
        expect(backing['/doc/exdev.txt']).toBeUndefined();

        expect(await rnfs.getFSInfo()).toEqual({ totalSpace: 9000, freeSpace: 3500 });
        expect(await rnfs.hash('/doc/a.txt', 'sha256')).toBe('hash-sha256');

        await rnfs.unlink('/doc/copy.txt');
        expect(backing['/doc/copy.txt']).toBeUndefined();
    });
});
