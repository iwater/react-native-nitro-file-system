import * as fsWeb from './index.web';
import { createRnfsCompat } from './rnfs-compat-shared';

export type {
    ReadDirItem,
    StatResult,
    FSInfoResult,
    MkdirOptions,
} from './rnfs-compat-shared';

const rnfs = createRnfsCompat(fsWeb);

export const {
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
    readdir,
    readDir,
    stat,
    copyFile,
    copyFileAssets,
    moveFile,
    getFSInfo,
    hash,
} = rnfs;

export default rnfs;

