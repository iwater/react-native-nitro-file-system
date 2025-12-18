import { HybridDirIterator } from './specs/HybridDirIterator.nitro';

export class Dirent {
    constructor(public name: string) { }

    isFile(): boolean {
        // TODO: Need type info from native layer
        return false;
    }
    isDirectory(): boolean {
        // TODO: Need type info from native layer
        return false;
    }
    isBlockDevice(): boolean { return false; }
    isCharacterDevice(): boolean { return false; }
    isSymbolicLink(): boolean { return false; }
    isFIFO(): boolean { return false; }
    isSocket(): boolean { return false; }
}

export class Dir {
    constructor(private internal: HybridDirIterator, public path: string) { }

    close(cb?: (err?: NodeJS.ErrnoException) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.closeSync();
                cb?.(undefined);
                resolve();
            } catch (e: any) {
                cb?.(e);
                reject(e);
            }
        });
    }

    closeSync(): void {
        this.internal.close();
    }

    read(cb?: (err: NodeJS.ErrnoException | null, dirEnt: Dirent | null) => void): Promise<Dirent | null> {
        return new Promise((resolve, reject) => {
            try {
                const result = this.readSync();
                cb?.(null, result);
                resolve(result);
            } catch (e: any) {
                cb?.(e, null);
                reject(e);
            }
        });
    }

    readSync(): Dirent | null {
        const name = this.internal.next();
        if (name == null) return null;
        return new Dirent(name);
    }

    async *[Symbol.asyncIterator](): AsyncIterableIterator<Dirent> {
        try {
            let entry: Dirent | null;
            while ((entry = await this.read()) !== null) {
                yield entry;
            }
        } finally {
            await this.close();
        }
    }
}
