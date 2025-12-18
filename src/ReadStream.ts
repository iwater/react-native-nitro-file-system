import { Readable, ReadableOptions } from 'readable-stream';
import { NitroFileSystem } from './native';
import { Buffer } from 'react-native-nitro-buffer';

export interface ReadStreamOptions extends ReadableOptions {
    flags?: string;
    encoding?: BufferEncoding;
    fd?: number | null;
    mode?: number;
    autoClose?: boolean;
    emitClose?: boolean;
    start?: number;
    end?: number;
    highWaterMark?: number;
}

export class ReadStream extends Readable {
    path: string | Buffer;
    fd: number | null;
    flags: string = 'r';
    mode: number = 0o666;
    start: number | undefined;
    end: number | undefined;
    pos: number;
    bytesRead: number = 0;
    autoClose: boolean;
    _fileClosed: boolean = false;
    pending: boolean = false;

    constructor(path: string | Buffer, options?: ReadStreamOptions) {
        // @ts-ignore
        super(options);

        this.path = path;
        this.fd = options?.fd === undefined ? null : options.fd;
        this.flags = options?.flags === undefined ? 'r' : options.flags;
        this.mode = options?.mode === undefined ? 0o666 : options.mode;
        this.start = options?.start;
        this.end = options?.end ?? Infinity;
        this.pos = this.start ?? 0;
        this.autoClose = options?.autoClose === undefined ? true : options.autoClose;

        if (this.fd === null) {
            this.pending = true;
            this._open();
        } else {
            this.pending = false;
        }

        // Handle closing cleanly
        this.on('end', () => {
            if (this.autoClose) {
                this.close();
            }
        });
    }

    _open() {
        // Translate flags to number for Rust
        // Simulating sync Open for now, or use setImmediate but we need fd for _read
        // Since _read is called by stream, we can open lazily or sync.

        // We'll mimic fs.openSync behavior internally for now to simplify
        // or actually, we should emit 'open' event asynchronously.

        // Simple flag mapping (incomplete)
        let flagNum = 0; // O_RDONLY
        // ... (We really need the central getFlags helper from index.ts, maybe export it?)
        if (this.flags === 'r') flagNum = 0;
        // else ... assume 0 for now or implement proper parsing

        try {
            if (typeof this.path !== 'string') throw new Error("Path must be string");

            // To be safe and async-like, we use immediate
            setImmediate(() => {
                try {
                    const fd = NitroFileSystem.open(this.path as string, flagNum, this.mode);
                    if (fd < 0) {
                        this.emit('error', new Error(`ENOENT: no such file or directory, open '${this.path}'`));
                        this._fileClosed = true;
                        return;
                    }
                    this.fd = fd;
                    this.pending = false;
                    this.emit('open', fd);
                    this.emit('ready');
                } catch (e) {
                    this.emit('error', e);
                    this._fileClosed = true;
                }
            });
        } catch (e) {
            this.emit('error', e);
            this._fileClosed = true;
        }
    }

    _read(n: number) {
        if (this.pending) {
            this.once('ready', () => this._read(n));
            return;
        }

        if (this._fileClosed || this.fd === null) {
            this.push(null);
            return;
        }

        const toRead = Math.min(n, (this.end !== undefined && this.end !== Infinity) ? (this.end - this.pos + 1) : n);
        if (toRead <= 0) {
            this.push(null);
            return;
        }

        // Allocate buffer
        const buffer = Buffer.allocUnsafe(toRead);

        try {
            // We use the sync read from native for now, wrapped in simple async structure of Readable
            // Ideally we'd have an async read API in Rust/C++.
            // Since JS thread shouldn't block, we assume for now small reads are fast or FS is fast.
            // CAUTION: This blocks JS thread!
            // But we don't have async read in Nitro yet (except implementing it via Thread).

            const bytesRead = NitroFileSystem.read(this.fd, buffer.buffer, buffer.byteOffset, toRead, this.pos);

            if (bytesRead > 0) {
                this.bytesRead += bytesRead;
                this.pos += bytesRead;
                this.push(buffer.slice(0, bytesRead));
            } else {
                this.push(null);
            }
        } catch (e) {
            this.emit('error', e);
        }
    }

    close(cb?: (err?: NodeJS.ErrnoException | null) => void) {
        if (this._fileClosed) {
            if (cb) cb();
            return;
        }

        if (this.fd !== null) {
            try {
                NitroFileSystem.close(this.fd);
                this.fd = null;
            } catch (e: any) {
                if (cb) cb(e);
                else this.emit('error', e);
                return;
            }
        }

        this._fileClosed = true;
        this.emit('close');
        if (cb) cb();
    }
}
