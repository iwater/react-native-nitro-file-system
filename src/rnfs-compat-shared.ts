import type {
    HashAlgorithm,
    NitroPaths,
    Stats,
    FsConstants,
} from './shared';
import type { StatFs } from './specs/HybridFileSystem.nitro';

export interface ReadDirItem {
    ctime?: Date;
    mtime?: Date;
    name: string;
    path: string;
    size: number;
    isFile(): boolean;
    isDirectory(): boolean;
}

export interface StatResult {
    path: string;
    ctime: Date;
    mtime: Date;
    size: number;
    mode: number;
    originalFilepath: string;
    isFile(): boolean;
    isDirectory(): boolean;
}

export interface FSInfoResult {
    totalSpace: number;
    freeSpace: number;
}

export interface MkdirOptions {
    NSURLIsExcludedFromBackupKey?: boolean;
}

export interface RnfsBackingFs {
    Paths: NitroPaths;
    constants: Pick<FsConstants, 'F_OK'>;
    mkdir: (path: string, options: { recursive?: boolean; mode?: number }, callback: (err: Error | null) => void) => void;
    promises: {
        access: (path: string, mode?: number) => Promise<void>;
        readFile: (path: string, options?: { encoding?: string; flag?: string } | string) => Promise<any>;
        writeFile: (path: string, data: string, options?: { encoding?: string; mode?: number; flag?: string } | string) => Promise<void>;
        appendFile: (path: string, data: string, options?: { encoding?: BufferEncoding; mode?: number; flag?: string } | BufferEncoding) => Promise<void>;
        rm: (path: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
        readdir: (path: string) => Promise<string[]>;
        stat: (path: string) => Promise<Stats>;
        lstat: (path: string) => Promise<Stats>;
        copyFile: (src: string, dest: string) => Promise<void>;
        cp: (src: string, dest: string, options?: { recursive?: boolean; force?: boolean }) => Promise<void>;
        rename: (oldPath: string, newPath: string) => Promise<void>;
        statfs: (path?: string) => Promise<StatFs>;
        hashFile: (path: string, algorithm?: HashAlgorithm) => Promise<string>;
    };
}

function joinChildPath(dirPath: string, name: string): string {
    if (!dirPath) return name;
    const base = dirPath.endsWith('/') && dirPath.length > 1 ? dirPath.slice(0, -1) : dirPath;
    return base === '/' ? `/${name}` : `${base}/${name}`;
}

function toAssetUri(filepath: string): string {
    if (filepath.startsWith('asset://')) return filepath;
    const trimmed = filepath.replace(/^\/+/, '');
    return `asset://${trimmed}`;
}

export function createRnfsCompat(fs: RnfsBackingFs) {
    const DocumentDirectoryPath = fs.Paths.document;
    const CachesDirectoryPath = fs.Paths.cache;
    const TemporaryDirectoryPath = fs.Paths.temp;
    const MainBundlePath = fs.Paths.mainBundle;
    const DownloadDirectoryPath = fs.Paths.download;
    const ExternalDirectoryPath = fs.Paths.external;
    const ExternalCachesDirectoryPath = fs.Paths.externalCache;
    const ExternalStorageDirectoryPath = fs.Paths.externalStorage;
    const LibraryDirectoryPath = fs.Paths.library;
    const PicturesDirectoryPath = fs.Paths.pictures;

    async function exists(filepath: string): Promise<boolean> {
        try {
            await fs.promises.access(filepath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }

    async function existsAssets(filepath: string): Promise<boolean> {
        return exists(toAssetUri(filepath));
    }

    async function readFile(filepath: string, encoding: string = 'utf8'): Promise<string> {
        const result = await fs.promises.readFile(filepath, encoding);
        return typeof result === 'string' ? result : String(result);
    }

    async function writeFile(filepath: string, contents: string, encoding: string = 'utf8'): Promise<void> {
        await fs.promises.writeFile(filepath, contents, encoding);
    }

    async function appendFile(filepath: string, contents: string, encoding: string = 'utf8'): Promise<void> {
        await fs.promises.appendFile(filepath, contents, encoding as BufferEncoding);
    }

    async function unlink(filepath: string): Promise<void> {
        await fs.promises.rm(filepath, { recursive: true, force: false });
    }

    function mkdir(filepath: string, _options?: MkdirOptions): Promise<void> {
        return new Promise((resolve, reject) => {
            fs.mkdir(filepath, { recursive: true }, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async function readDir(dirpath: string): Promise<ReadDirItem[]> {
        const names = await fs.promises.readdir(dirpath);
        return Promise.all(
            names.map(async (name) => {
                const fullPath = joinChildPath(dirpath, name);
                try {
                    const s = await fs.promises.stat(fullPath).catch(() => fs.promises.lstat(fullPath));
                    return {
                        ctime: s.ctime,
                        mtime: s.mtime,
                        name,
                        path: fullPath,
                        size: s.size,
                        isFile: () => s.isFile(),
                        isDirectory: () => s.isDirectory(),
                    };
                } catch {
                    return {
                        name,
                        path: fullPath,
                        size: 0,
                        isFile: () => false,
                        isDirectory: () => false,
                    };
                }
            })
        );
    }

    async function stat(filepath: string): Promise<StatResult> {
        const s = await fs.promises.stat(filepath);
        return {
            path: filepath,
            ctime: s.ctime,
            mtime: s.mtime,
            size: s.size,
            mode: s.mode,
            originalFilepath: filepath,
            isFile: () => s.isFile(),
            isDirectory: () => s.isDirectory(),
        };
    }

    async function copyFile(filepath: string, destPath: string): Promise<void> {
        await fs.promises.copyFile(filepath, destPath);
    }

    async function copyFileAssets(filepath: string, destPath: string): Promise<void> {
        await fs.promises.copyFile(toAssetUri(filepath), destPath);
    }

    async function moveFile(filepath: string, destPath: string): Promise<void> {
        try {
            await fs.promises.rename(filepath, destPath);
        } catch (err: any) {
            if (err?.code === 'EXDEV') {
                await fs.promises.cp(filepath, destPath, { recursive: true, force: true });
                await fs.promises.rm(filepath, { recursive: true, force: false });
                return;
            }
            throw err;
        }
    }

    async function getFSInfo(): Promise<FSInfoResult> {
        const info = await fs.promises.statfs(fs.Paths.document || '/');
        return {
            totalSpace: info.totalBytes,
            freeSpace: info.availableBytes,
        };
    }

    async function hash(filepath: string, algorithm: HashAlgorithm = 'md5'): Promise<string> {
        return fs.promises.hashFile(filepath, algorithm);
    }

    return {
        DocumentDirectoryPath,
        CachesDirectoryPath,
        TemporaryDirectoryPath,
        MainBundlePath,
        DownloadDirectoryPath,
        ExternalDirectoryPath,
        ExternalCachesDirectoryPath,
        ExternalStorageDirectoryPath,
        LibraryDirectoryPath,
        PicturesDirectoryPath,
        exists,
        existsAssets,
        readFile,
        writeFile,
        appendFile,
        unlink,
        mkdir,
        readDir,
        stat,
        copyFile,
        copyFileAssets,
        moveFile,
        getFSInfo,
        hash,
    };
}

