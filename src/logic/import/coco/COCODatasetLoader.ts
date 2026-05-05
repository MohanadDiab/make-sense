import {sortBy} from 'lodash';
import {COCOImporter} from './COCOImporter';
import {ImageData, LabelName} from '../../../store/labels/types';
import {ImageDataUtil} from '../../../utils/ImageDataUtil';
import {FileUtil} from '../../../utils/FileUtil';
import {COCOCategory} from '../../../data/labels/COCO';
import {LabelUtil} from '../../../utils/LabelUtil';
import {COCOUtils} from './COCOUtils';
import {v4 as uuidv4} from 'uuid';
import {Settings} from '../../../settings/Settings';
import {ArrayUtil} from '../../../utils/ArrayUtil';

type DatasetLoadWarnings = {
    missingFromDirectory: string[];
    imagesWithoutAnnotations: string[];
}

export type COCODatasetLoadResult = {
    imagesData: ImageData[];
    labelNames: LabelName[];
    warnings: DatasetLoadWarnings;
}

export class COCODatasetLoader {
    public static collectPreview(imageFiles: File[]): {
        imageCount: number;
    } {
        const filteredImageFiles = imageFiles
            .filter((file: File) => COCODatasetLoader.isImageFile(file));

        return {
            imageCount: filteredImageFiles.length,
        };
    }

    public static async load(imageFiles: File[], annotationFile: File): Promise<COCODatasetLoadResult> {
        const filteredImageFiles = imageFiles
            .filter((file: File) => COCODatasetLoader.isImageFile(file));
        const sortedFiles = sortBy(filteredImageFiles, (file: File) => file.name.toLowerCase());
        const inputImagesData = sortedFiles.map((file: File) => ImageDataUtil.createImageDataFromFileData(file));
        const annotationText = await FileUtil.readFile(annotationFile);
        const cocoObject = COCOImporter.deserialize(annotationText);
        COCOImporter.validateCocoFormat(cocoObject);
        const {labelNames, categoryIdToLabelId} = COCODatasetLoader.mapCategories(cocoObject.categories || []);

        const selectedByPathKey = new Map<string, ImageData>();
        const selectedByBaseNameKey = new Map<string, ImageData[]>();
        for (const imageData of inputImagesData) {
            const fullKey = COCODatasetLoader.toPathKey(COCODatasetLoader.getFilePath(imageData.fileData));
            const baseKey = COCODatasetLoader.toBaseNameKey(COCODatasetLoader.getFilePath(imageData.fileData));
            selectedByPathKey.set(fullKey, imageData);
            const existing = selectedByBaseNameKey.get(baseKey) || [];
            existing.push(imageData);
            selectedByBaseNameKey.set(baseKey, existing);
        }

        const cocoToSelectedById = new Map<number, ImageData>();
        const matchedCocoPathKeys = new Set<string>();
        const matchedSelectedPathKeys = new Set<string>();
        for (const cocoImage of (cocoObject.images || [])) {
            const pathKey = COCODatasetLoader.toPathKey(cocoImage.file_name);
            const baseKey = COCODatasetLoader.toBaseNameKey(cocoImage.file_name);
            const baseMatches = selectedByBaseNameKey.get(baseKey) || [];
            const selected = selectedByPathKey.get(pathKey) || (baseMatches.length === 1 ? baseMatches[0] : undefined);
            if (selected) {
                cocoToSelectedById.set(cocoImage.id, selected);
                matchedCocoPathKeys.add(pathKey);
                matchedSelectedPathKeys.add(COCODatasetLoader.toPathKey(COCODatasetLoader.getFilePath(selected.fileData)));
            }
        }

        for (const annotation of (cocoObject.annotations || [])) {
            const targetImage = cocoToSelectedById.get(annotation.image_id);
            if (!targetImage || annotation.iscrowd === 1) {
                continue;
            }
            const labelId = categoryIdToLabelId[annotation.category_id] || null;
            if (Array.isArray(annotation.bbox) && annotation.bbox.length >= 4) {
                targetImage.labelRects.push(LabelUtil.createLabelRect(
                    labelId,
                    COCOUtils.bbox2rect(annotation.bbox)
                ));
            }

            if (Array.isArray(annotation.segmentation)) {
                const polygons = COCOUtils.segmentation2vertices(annotation.segmentation);
                for (const polygon of polygons) {
                    targetImage.labelPolygons.push(LabelUtil.createLabelPolygon(labelId, polygon));
                }
            }
        }

        const cocoKeys = new Set((cocoObject.images || []).map((image) => COCODatasetLoader.toPathKey(image.file_name)));
        const missingFromDirectory = Array.from(cocoKeys).filter((fileName: string) => !matchedCocoPathKeys.has(fileName));

        const selectedKeys = new Set(sortedFiles.map((file: File) => COCODatasetLoader.toPathKey(COCODatasetLoader.getFilePath(file))));
        const imagesWithoutAnnotations = Array.from(selectedKeys)
            .filter((fileName: string) => !matchedSelectedPathKeys.has(fileName))
            .map((pathKey: string) => COCODatasetLoader.toBaseNameKey(pathKey));

        return {
            imagesData: inputImagesData,
            labelNames,
            warnings: {
                missingFromDirectory,
                imagesWithoutAnnotations,
            }
        };
    }

    private static isImageFile(file: File): boolean {
        const lower = file.name.toLowerCase();
        return lower.endsWith('.jpg')
            || lower.endsWith('.jpeg')
            || lower.endsWith('.png')
            || lower.endsWith('.tif')
            || lower.endsWith('.tiff');
    }

    private static getFilePath(file: File): string {
        const filePath = (file as any).webkitRelativePath || file.name;
        return `${filePath}`;
    }

    private static toPathKey(pathLike: string): string {
        const normalizedSlashes = pathLike.trim().replace(/\\/g, '/');
        const parts = normalizedSlashes.split('/').filter(Boolean);
        const fileName = (parts.pop() || '').toLowerCase();
        const parentName = (parts.pop() || '').toLowerCase();
        return parentName ? `${parentName}/${fileName}` : fileName;
    }

    private static toBaseNameKey(pathLike: string): string {
        const normalizedSlashes = pathLike.trim().replace(/\\/g, '/');
        const parts = normalizedSlashes.split('/').filter(Boolean);
        const fileName = (parts.pop() || '').toLowerCase();
        return fileName;
    }

    private static mapCategories(categories: COCOCategory[]): {labelNames: LabelName[]; categoryIdToLabelId: {[id: number]: string}} {
        const categoryIdToLabelId: {[id: number]: string} = {};
        const labels = categories.map((category: COCOCategory, index: number) => {
            const id = uuidv4();
            categoryIdToLabelId[category.id] = id;
            return {
                id,
                name: category.name,
                color: ArrayUtil.getByInfiniteIndex(Settings.LABEL_COLORS_PALETTE, index)
            };
        });
        return {
            labelNames: labels,
            categoryIdToLabelId
        };
    }
}
