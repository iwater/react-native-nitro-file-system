describe('Web platform fallback (index.web & rnfs-compat.web)', () => {
    beforeEach(() => {
        jest.resetModules();
    });

    it('loads index.web and rnfs-compat.web without touching react-native-nitro-modules or react-native-nitro-buffer', () => {
        jest.doMock('react-native-nitro-modules', () => {
            throw new Error('Must NOT import react-native-nitro-modules on web');
        });
        jest.doMock('react-native-nitro-buffer', () => {
            throw new Error('Must NOT import react-native-nitro-buffer on web');
        });

        const webFs = require('../src/index.web');
        const webRnfs = require('../src/rnfs-compat.web');

        expect(webFs.constants.F_OK).toBe(0);
        expect(webFs.constants.O_RDONLY).toBe(0);
        expect(webFs.bundleUri).toBe('');
        expect(webFs.Paths.document).toBe('');
        expect(webFs.Paths.bundleUri).toBe('');
        expect(webFs.Paths.bundleAssetUri).toBe('');
        expect(webFs.getBundleAssetUri('images/a.png')).toBe('');
        expect(webFs.toPlatformAssetUri('asset://images/a.png')).toBe('asset://images/a.png');
        expect(webFs.toPlatformAssetUri('/tmp/a b.png')).toBe('file:///tmp/a%20b.png');
        expect(webFs.Paths.availableDiskSpace).toBe(0);
        expect(webFs.Paths.totalDiskSpace).toBe(0);
        expect(Object.keys(webFs.Paths)).not.toContain('availableDiskSpace');
        expect(Object.keys(webFs.Paths)).not.toContain('totalDiskSpace');

        expect(webRnfs.DocumentDirectoryPath).toBe('');
        expect(webRnfs.CachesDirectoryPath).toBe('');
        expect(typeof webRnfs.exists).toBe('function');
        expect(typeof webRnfs.hash).toBe('function');
    });

    it('matches named, default, and promises export keys of src/index.ts', () => {
        const mockHybrid = {
            openFlagValues: [0, 1, 2, 512, 2048, 131072, 1024, 8, 1048576, -1, 256, 128, 4194304, 2097152, -1, 4],
            fileProtectionKeys: {},
            bundleUri: 'file:///app.app',
            cachesDirectoryPath: '/tmp/cache',
            documentDirectoryPath: '/tmp/doc',
            downloadDirectoryPath: '/tmp/dl',
            externalCachesDirectoryPath: '',
            externalDirectoryPath: '',
            externalStorageDirectoryPath: '',
            libraryDirectoryPath: '/tmp/lib',
            mainBundlePath: '/app.app',
            picturesDirectoryPath: '',
            temporaryDirectoryPath: '/tmp',
            statfs: () => ({
                totalBytes: 1000,
                availableBytes: 500,
                freeBytes: 600,
                type: 1,
                bsize: 4096,
                blocks: 10,
                bfree: 6,
                bavail: 5,
                files: 100,
                ffree: 90,
            }),
        };

        jest.doMock('react-native-nitro-modules', () => ({
            NitroModules: {
                createHybridObject: () => mockHybrid,
            },
        }));
        jest.doMock('react-native-nitro-buffer', () => ({
            Buffer: globalThis.Buffer,
        }));

        const nativeFs = require('../src/index');
        const webFs = require('../src/index.web');

        const filterInternalKeys = (keys: string[]) => keys.filter((k) => k !== '__esModule').sort();
        expect(filterInternalKeys(Object.keys(webFs))).toEqual(filterInternalKeys(Object.keys(nativeFs)));
        expect(Object.keys(webFs.default).sort()).toEqual(Object.keys(nativeFs.default).sort());
        expect(Object.keys(webFs.promises).sort()).toEqual(Object.keys(nativeFs.promises).sort());
    });

    it('provides safe exists/existsSync, pure URI helpers, and expected errors for sync/callback/promises/streams', async () => {
        const webFs = require('../src/index.web');

        expect(webFs.existsSync('/foo/bar')).toBe(false);
        await expect(
            new Promise<boolean>((resolve) => webFs.exists('/foo/bar', resolve))
        ).resolves.toBe(false);

        expect(webFs.normalizePath('file:///a%20b/c.txt')).toBe('/a b/c.txt');
        expect(webFs.toFileUri('/a b/c.txt')).toBe('file:///a%20b/c.txt');

        expect(() => webFs.statSync('/foo')).toThrow('[NitroFS] Not supported on web platform');
        expect(() => webFs.statfsSync('/foo')).toThrow('[NitroFS] Not supported on web platform');
        expect(() => webFs.hashFileSync('/foo', 'sha256')).toThrow('[NitroFS] Not supported on web platform');

        await expect(webFs.promises.readFile('/foo')).rejects.toThrow('[NitroFS] Not supported on web platform');
        await expect(webFs.promises.statfs('/foo')).rejects.toThrow('[NitroFS] Not supported on web platform');
        await expect(webFs.promises.hashFile('/foo', 'sha256')).rejects.toThrow('[NitroFS] Not supported on web platform');
        await expect(webFs.pickFiles()).rejects.toThrow('[NitroFS] Not supported on web platform');
        await expect(webFs.pickDirectory()).rejects.toThrow('[NitroFS] Not supported on web platform');

        const callbackErr = await new Promise<Error>((resolve) => {
            webFs.readFile('/foo', (err: Error) => resolve(err));
        });
        expect(callbackErr.message).toContain('Not supported on web platform');

        const streamErr = await new Promise<Error>((resolve) => {
            const rs = webFs.createReadStream('/foo');
            rs.on('error', (err: Error) => resolve(err));
        });
        expect(streamErr.message).toContain('Not supported on web platform');

        const watcher = webFs.watch('/foo');
        const closePromise = new Promise<void>((resolve) => watcher.on('close', resolve));
        watcher.close();
        await closePromise;
    });
});

