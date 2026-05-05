import {store} from '../../index';
import {FileDisplayUtil} from '../../utils/FileDisplayUtil';
import {ImageData, LabelName} from '../../store/labels/types';
import {ImageRepository} from '../imageRepository/ImageRepository';

type AutosaveState = {
    enabled: boolean;
    manualFileName: string | null;
    fileHandle: FileSystemFileHandle | null;
    lastSavedRevision: number;
    saveError: string | null;
    debounceTimer: any;
    intervalId: any;
}

const initialState: AutosaveState = {
    enabled: false,
    manualFileName: null,
    fileHandle: null,
    lastSavedRevision: 0,
    saveError: null,
    debounceTimer: null,
    intervalId: null
};

export class CocoManualAutosave {
    private static state: AutosaveState = {...initialState};
    private static unsubscribe: (() => void) | null = null;

    /**
     * Must be called synchronously from a user gesture (click) by *starting* the picker promise
     * before any other awaits in the click handler.
     */
    public static beginPickManualFileHandle(manualFileName: string): Promise<FileSystemFileHandle | null> | null {
        const w: any = window as any;
        if (!w?.showSaveFilePicker) {
            return null;
        }
        return (async () => {
            try {
                return await w.showSaveFilePicker({
                    suggestedName: manualFileName,
                    types: [
                        {
                            description: 'COCO JSON',
                            accept: {'application/json': ['.json']}
                        }
                    ]
                }) as FileSystemFileHandle;
            } catch {
                return null;
            }
        })();
    }

    public static getManualSuggestedName(annotationFileName: string): string {
        return CocoManualAutosave.getManualFileName(annotationFileName);
    }

    public static async enableForCocoDataset(annotationFileName: string, prefFileHandle?: FileSystemFileHandle | null): Promise<void> {
        CocoManualAutosave.disable();
        const manualFileName = CocoManualAutosave.getManualFileName(annotationFileName);

        CocoManualAutosave.state = {
            ...CocoManualAutosave.state,
            enabled: true,
            manualFileName,
            fileHandle: prefFileHandle || null,
            lastSavedRevision: store.getState().labels.annotationsRevision || 0,
            saveError: null
        };

        CocoManualAutosave.unsubscribe = store.subscribe(() => {
            const revision = store.getState().labels.annotationsRevision || 0;
            if (revision !== CocoManualAutosave.state.lastSavedRevision) {
                CocoManualAutosave.scheduleSave();
            }
        });

        CocoManualAutosave.state.intervalId = setInterval(() => {
            CocoManualAutosave.flush('interval').catch(() => null);
        }, 30000);

        await CocoManualAutosave.flush('initial');
    }

    public static disable(): void {
        if (CocoManualAutosave.state.debounceTimer) {
            clearTimeout(CocoManualAutosave.state.debounceTimer);
        }
        if (CocoManualAutosave.state.intervalId) {
            clearInterval(CocoManualAutosave.state.intervalId);
        }
        if (CocoManualAutosave.unsubscribe) {
            CocoManualAutosave.unsubscribe();
        }
        CocoManualAutosave.unsubscribe = null;
        CocoManualAutosave.state = {...initialState};
    }

    public static isEnabled(): boolean {
        return CocoManualAutosave.state.enabled;
    }

    public static shouldWarnOnExit(): boolean {
        if (!CocoManualAutosave.state.enabled) {
            return false;
        }
        const revision = store.getState().labels.annotationsRevision || 0;
        const dirty = revision !== CocoManualAutosave.state.lastSavedRevision;
        return dirty || !CocoManualAutosave.state.fileHandle || !!CocoManualAutosave.state.saveError;
    }

    public static async flush(reason: 'image_change' | 'interval' | 'initial' | 'debounced' = 'debounced'): Promise<boolean> {
        if (!CocoManualAutosave.state.enabled) {
            return false;
        }
        const revision = store.getState().labels.annotationsRevision || 0;
        if (revision === CocoManualAutosave.state.lastSavedRevision && reason !== 'initial') {
            return true;
        }
        const content = CocoManualAutosave.buildCocoFromCurrentState();
        try {
            if (CocoManualAutosave.state.fileHandle) {
                const writable = await CocoManualAutosave.state.fileHandle.createWritable();
                await writable.write(content);
                await writable.close();
                CocoManualAutosave.state.lastSavedRevision = revision;
                CocoManualAutosave.state.saveError = null;
                return true;
            }
            CocoManualAutosave.state.saveError = 'Autosave requires choosing a save target for the manual file.';
            return false;
        } catch (e) {
            CocoManualAutosave.state.saveError = e instanceof Error ? e.message : 'Autosave failed.';
            return false;
        }
    }

    public static async exportManualFile(): Promise<boolean> {
        if (!CocoManualAutosave.state.enabled || !CocoManualAutosave.state.manualFileName) {
            return false;
        }
        if (!CocoManualAutosave.state.fileHandle) {
            await CocoManualAutosave.tryCreateFileHandle(CocoManualAutosave.state.manualFileName);
        }
        return CocoManualAutosave.flush('initial');
    }

    public static getManualFileNameIfEnabled(): string | null {
        return CocoManualAutosave.state.enabled ? CocoManualAutosave.state.manualFileName : null;
    }

    public static buildManualCocoJson(): string {
        return CocoManualAutosave.buildCocoFromCurrentState();
    }

    private static scheduleSave(): void {
        if (CocoManualAutosave.state.debounceTimer) {
            clearTimeout(CocoManualAutosave.state.debounceTimer);
        }
        CocoManualAutosave.state.debounceTimer = setTimeout(() => {
            CocoManualAutosave.flush('debounced').catch(() => null);
        }, 1000);
    }

    private static async tryCreateFileHandle(manualFileName: string): Promise<void> {
        const w: any = window as any;
        if (!w?.showSaveFilePicker) {
            return;
        }
        try {
            const fileHandle: FileSystemFileHandle = await w.showSaveFilePicker({
                suggestedName: manualFileName,
                types: [
                    {
                        description: 'COCO JSON',
                        accept: {'application/json': ['.json']}
                    }
                ]
            });
            CocoManualAutosave.state.fileHandle = fileHandle;
        } catch {
            // user cancelled or browser denied
        }
    }

    private static getManualFileName(annotationFileName: string): string {
        const trimmed = `${annotationFileName || ''}`.trim();
        if (trimmed.toLowerCase().endsWith('.json')) {
            return trimmed.slice(0, -5) + '_manual.json';
        }
        return trimmed + '_manual.json';
    }

    private static buildCocoFromCurrentState(): string {
        const state = store.getState();
        const imagesData: ImageData[] = state.labels.imagesData || [];
        const labelNames: LabelName[] = state.labels.labels || [];

        const categoryIdByLabelId: {[labelId: string]: number} = {};
        labelNames.forEach((ln: LabelName, idx: number) => {
            categoryIdByLabelId[ln.id] = idx + 1;
        });

        const images = imagesData.map((img: ImageData, idx: number) => {
            const file_name = FileDisplayUtil.getFilePath(img.fileData).replace(/\\/g, '/');
            let width = img.rasterMeta?.width || 0;
            let height = img.rasterMeta?.height || 0;
            if ((!width || !height) && img.loadStatus) {
                try {
                    const el = ImageRepository.getById(img.id);
                    width = width || el.width;
                    height = height || el.height;
                } catch {
                    // ignore
                }
            }
            return {
                id: idx + 1,
                width,
                height,
                file_name
            };
        });

        let annId = 1;
        const annotations: any[] = [];
        imagesData.forEach((img: ImageData, idx: number) => {
            (img.labelRects || []).forEach((rectLabel: any) => {
                const category_id = rectLabel.labelId ? categoryIdByLabelId[rectLabel.labelId] : undefined;
                if (!category_id) {
                    return;
                }
                const bbox = [rectLabel.rect.x, rectLabel.rect.y, rectLabel.rect.width, rectLabel.rect.height];
                annotations.push({
                    id: annId++,
                    image_id: idx + 1,
                    category_id,
                    bbox,
                    area: rectLabel.rect.width * rectLabel.rect.height,
                    iscrowd: 0
                });
            });
        });

        const categories = labelNames.map((ln: LabelName, idx: number) => ({
            id: idx + 1,
            name: ln.name
        }));

        return JSON.stringify({
            info: {description: state.general?.projectData?.name || 'manual'},
            images,
            annotations,
            categories
        });
    }
}
