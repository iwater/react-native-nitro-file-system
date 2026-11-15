describe('URI helpers, Paths, statfs, and hashFile', () => {
    const createMockHybrid = (overrides: Record<string, any> = {}) => ({
        openFlagValues: [0, 1, 2, 512, 2048, 131072, 1024, 8, 1048576, -1, 256, 128, 4194304, 2097152, -1, 4],
        fileProtectionKeys: {},
        bundleUri: 'file:///Applications/Demo.app',
        cachesDirectoryPath: '/var/mobile/Caches',
        documentDirectoryPath: '/var/mobile/Documents with space',
        downloadDirectoryPath: '/var/mobile/Downloads',
        externalCachesDirectoryPath: '',
        externalDirectoryPath: '',
        externalStorageDirectoryPath: '',
        libraryDirectoryPath: '/var/mobile/Library',
        mainBundlePath: '/Applications/Demo.app',
        picturesDirectoryPath: '',
        temporaryDirectoryPath: '/tmp',
        lastErrno: 0,
        lastErrorCode: '',
        statfs: jest.fn(() => ({
            totalBytes: 1000000,
            availableBytes: 400000,
            freeBytes: 450000,
            type: 26,
            bsize: 4096,
            blocks: 250,
            bfree: 110,
            bavail: 98,
            files: 5000,
            ffree: 4200,
        })),
        hashFile: jest.fn(async (_p: string, algo: string) => `async-${algo}-hash`),
        hashFileSync: jest.fn((_p: string, algo: string) => `sync-${algo}-hash`),
        ...overrides,
    });

    beforeEach(() => {
        jest.resetModules();
    });

    it('handles toFileUri and normalizePath round-trips cleanly', () => {
        const mockHybrid = createMockHybrid();
        jest.doMock('react-native-nitro-modules', () => ({
            NitroModules: { createHybridObject: () => mockHybrid },
        }));
        jest.doMock('react-native-nitro-buffer', () => ({ Buffer: globalThis.Buffer }));

        const fs = require('../src/index');

        expect(fs.toFileUri('')).toBe('');
        expect(fs.toFileUri('/tmp/hello world/测试#1%25.txt')).toBe(
            'file:///tmp/hello%20world/%E6%B5%8B%E8%AF%95%231%2525.txt'
        );
        // Idempotent when already encoded as file:// URI
        const encoded = fs.toFileUri('/tmp/hello world/测试#1.txt');
        expect(fs.toFileUri(encoded)).toBe(encoded);
        expect(fs.normalizePath(encoded)).toBe('/tmp/hello world/测试#1.txt');

        // Single-slash file:/ form and URL objects
        expect(fs.toFileUri('file:/tmp/a b')).toBe('file:///tmp/a%20b');
        expect(fs.normalizePath(new URL('file:///tmp/a%20b/c.txt'))).toBe('/tmp/a b/c.txt');

        // Non-file URI schemes are preserved
        expect(fs.toFileUri('content://com.example/doc/1')).toBe('content://com.example/doc/1');
        expect(fs.toFileUri('bookmark://opaque-token')).toBe('bookmark://opaque-token');
        expect(fs.toFileUri('asset://fonts/roboto.ttf')).toBe('asset://fonts/roboto.ttf');

        // Paths properties & non-enumerable disk getters
        expect(fs.bundleUri).toBe('file:///Applications/Demo.app');
        expect(fs.Paths.bundleUri).toBe('file:///Applications/Demo.app');
        expect(fs.Paths.documentUri).toBe('file:///var/mobile/Documents%20with%20space');
        expect(fs.Paths.cacheUri).toBe('file:///var/mobile/Caches');
        expect(fs.Paths.tempUri).toBe('file:///tmp');

        expect(Object.keys(fs.Paths)).not.toContain('availableDiskSpace');
        expect(Object.keys(fs.Paths)).not.toContain('totalDiskSpace');
        expect(fs.Paths.availableDiskSpace).toBe(400000);
        expect(fs.Paths.totalDiskSpace).toBe(1000000);
    });

    it('supports statfsSync, statfs callbacks, promises.statfs, BigIntStatFs, and ENOENT shaping', async () => {
        const mockHybrid = createMockHybrid();
        mockHybrid.statfs.mockImplementation((p: string) => {
            if (p === '/missing') {
                mockHybrid.lastErrno = 2;
                mockHybrid.lastErrorCode = 'ENOENT';
                throw new Error('No such file or directory');
            }
            return {
                totalBytes: 8192000,
                availableBytes: 4096000,
                freeBytes: 4096000,
                type: 26,
                bsize: 4096,
                blocks: 2000,
                bfree: 1000,
                bavail: 1000,
                files: 500,
                ffree: 400,
            };
        });

        jest.doMock('react-native-nitro-modules', () => ({
            NitroModules: { createHybridObject: () => mockHybrid },
        }));
        jest.doMock('react-native-nitro-buffer', () => ({ Buffer: globalThis.Buffer }));

        const fs = require('../src/index');

        const s = fs.statfsSync('file:///tmp/my%20dir');
        expect(mockHybrid.statfs).toHaveBeenCalledWith('/tmp/my dir');
        expect(s.availableBytes).toBe(4096000);

        const bs = fs.statfsSync('/tmp/my dir', { bigint: true });
        expect(typeof bs.totalBytes).toBe('bigint');
        expect(bs.totalBytes).toBe(8192000n);

        // Callback overload (cb only)
        const cbRes = await new Promise<any>((resolve, reject) => {
            fs.statfs((err: Error | null, res: any) => (err ? reject(err) : resolve(res)));
        });
        expect(cbRes.totalBytes).toBe(8192000);

        // Promises API + bigint
        const pRes = await fs.promises.statfs('/tmp', { bigint: true });
        expect(pRes.availableBytes).toBe(4096000n);

        // ENOENT shaping
        try {
            fs.statfsSync('/missing');
            throw new Error('Expected statfsSync to throw');
        } catch (err: any) {
            expect(err.code).toBe('ENOENT');
            expect(err.errno).toBe(-2);
            expect(err.syscall).toBe('statfs');
            expect(err.path).toBe('/missing');
        }
    });

    it('delegates hashFileSync and promises.hashFile with normalized paths', async () => {
        const mockHybrid = createMockHybrid();
        jest.doMock('react-native-nitro-modules', () => ({
            NitroModules: { createHybridObject: () => mockHybrid },
        }));
        jest.doMock('react-native-nitro-buffer', () => ({ Buffer: globalThis.Buffer }));

        const fs = require('../src/index');

        expect(fs.hashFileSync('file:///tmp/a%20b.bin', 'sha256')).toBe('sync-sha256-hash');
        expect(mockHybrid.hashFileSync).toHaveBeenCalledWith('/tmp/a b.bin', 'sha256');

        await expect(fs.promises.hashFile('asset://data/test.bin', 'sha512')).resolves.toBe('async-sha512-hash');
        expect(mockHybrid.hashFile).toHaveBeenCalledWith('asset://data/test.bin', 'sha512');
    });
});

