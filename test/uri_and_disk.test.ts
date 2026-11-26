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

        // Android file:///android_asset/ and /android_asset/ input normalization
        expect(fs.normalizePath('file:///android_asset/fonts/My%20Font.ttf')).toBe('asset://fonts/My Font.ttf');
        expect(fs.normalizePath('file:/android_asset/fonts/roboto.ttf')).toBe('asset://fonts/roboto.ttf');
        expect(fs.normalizePath(new URL('file:///android_asset/images/cover%201.png'))).toBe('asset://images/cover 1.png');
        expect(fs.normalizePath('/android_asset/images/cover.png')).toBe('asset://images/cover.png');
        expect(fs.normalizePath('file:///android_asset/')).toBe('asset://');
        expect(fs.normalizePath('file:///android_asset')).toBe('asset://');
        expect(fs.normalizePath('/android_asset/')).toBe('asset://');
        expect(fs.normalizePath('/android_asset')).toBe('asset://');
        expect(fs.toFileUri('file:///android_asset/images/cover%201.png')).toBe('file:///android_asset/images/cover%201.png');
        expect(fs.toFileUri('/android_asset/images/cover 1.png')).toBe('file:///android_asset/images/cover%201.png');

        // Paths properties & non-enumerable disk getters
        expect(fs.bundleUri).toBe('file:///Applications/Demo.app');
        expect(fs.Paths.bundleUri).toBe('file:///Applications/Demo.app');
        expect(fs.Paths.bundleAssetUri).toBe('file:///Applications/Demo.app/');
        expect(fs.Paths.documentUri).toBe('file:///var/mobile/Documents%20with%20space');
        expect(fs.Paths.cacheUri).toBe('file:///var/mobile/Caches');
        expect(fs.Paths.tempUri).toBe('file:///tmp');

        // Platform asset URI helpers on iOS
        expect(fs.getBundleAssetUri()).toBe('file:///Applications/Demo.app/');
        expect(fs.getBundleAssetUri('images/cover 1.png')).toBe('file:///Applications/Demo.app/images/cover%201.png');
        expect(fs.getBundleAssetUri('/images/cover#1.png')).toBe('file:///Applications/Demo.app/images/cover%231.png');
        expect(fs.toPlatformAssetUri('asset://images/cover%201.png')).toBe('file:///Applications/Demo.app/images/cover%201.png');
        expect(fs.toPlatformAssetUri('file:///android_asset/images/cover%201.png')).toBe('file:///Applications/Demo.app/images/cover%201.png');
        expect(fs.toPlatformAssetUri('https://example.com/a.png')).toBe('https://example.com/a.png');
        expect(fs.toPlatformAssetUri('data:image/png;base64,AAA')).toBe('data:image/png;base64,AAA');

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

        await expect(fs.promises.hashFile('file:///android_asset/data/test%201.bin', 'md5')).resolves.toBe('async-md5-hash');
        expect(mockHybrid.hashFile).toHaveBeenCalledWith('asset://data/test 1.bin', 'md5');
    });

    it('keeps Paths.bundleUri as asset:// on Android while exposing file:///android_asset/ helpers', () => {
        const mockHybrid = createMockHybrid({ bundleUri: 'asset://' });
        jest.doMock('react-native-nitro-modules', () => ({
            NitroModules: { createHybridObject: () => mockHybrid },
        }));
        jest.doMock('react-native-nitro-buffer', () => ({ Buffer: globalThis.Buffer }));

        const fs = require('../src/index');

        expect(fs.bundleUri).toBe('asset://');
        expect(fs.Paths.bundleUri).toBe('asset://');
        expect(fs.Paths.bundleAssetUri).toBe('file:///android_asset/');

        expect(fs.getBundleAssetUri()).toBe('file:///android_asset/');
        expect(fs.getBundleAssetUri('images/cover 1.png')).toBe('file:///android_asset/images/cover%201.png');
        expect(fs.getBundleAssetUri('/fonts/My Font#1.ttf')).toBe('file:///android_asset/fonts/My%20Font%231.ttf');
        expect(fs.toPlatformAssetUri('asset://images/cover%201.png')).toBe('file:///android_asset/images/cover%201.png');
        expect(fs.toPlatformAssetUri('asset://')).toBe('file:///android_asset/');
        expect(fs.toPlatformAssetUri('file:///android_asset/images/cover%201.png')).toBe('file:///android_asset/images/cover%201.png');
        expect(fs.toPlatformAssetUri('/android_asset/images/cover 1.png')).toBe('file:///android_asset/images/cover%201.png');
        expect(fs.toPlatformAssetUri('/data/user/0/app/files/local file.png')).toBe('file:///data/user/0/app/files/local%20file.png');
        expect(fs.toPlatformAssetUri('content://media/external/images/1')).toBe('content://media/external/images/1');

        // Round-trip: UI URI can be passed straight back into fs APIs
        const uiUri = fs.getBundleAssetUri('data/test 1.bin');
        expect(uiUri).toBe('file:///android_asset/data/test%201.bin');
        expect(fs.hashFileSync(uiUri, 'sha256')).toBe('sync-sha256-hash');
        expect(mockHybrid.hashFileSync).toHaveBeenCalledWith('asset://data/test 1.bin', 'sha256');
    });
});

