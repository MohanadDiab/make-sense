export class FileDisplayUtil {
    public static getFilePath(file: File): string {
        const filePath = (file as any)?.webkitRelativePath || file?.name || '';
        return `${filePath}`;
    }

    /**
     * Prefer showing a stable, unique identifier for folder-based datasets:
     * last parent + filename (e.g. "tileA/r0_c0.tif"). Falls back to filename.
     */
    public static getShortDisplayName(file: File): string {
        const path = FileDisplayUtil.getFilePath(file).trim().replace(/\\/g, '/');
        const parts = path.split('/').filter(Boolean);
        const fileName = parts.pop() || path;
        const parent = parts.pop();
        return parent ? `${parent}/${fileName}` : fileName;
    }
}

