import {ImageData, LabelName} from '../../../store/labels/types';
import {LabelsSelector} from '../../../store/selectors/LabelsSelector';
import {COCOCategory, COCOImage, COCOObject} from '../../../data/labels/COCO';
import { v4 as uuidv4 } from 'uuid';
import {ArrayUtil, PartitionResult} from '../../../utils/ArrayUtil';
import {ImageDataUtil} from '../../../utils/ImageDataUtil';
import {LabelUtil} from '../../../utils/LabelUtil';
import {
    COCOAnnotationDeserializationError,
    COCOAnnotationFileCountError,
    COCOAnnotationReadingError,
    COCOFormatValidationError
} from './COCOErrors';
import {LabelType} from '../../../data/enums/LabelType';
import {AnnotationImporter, ImportResult} from '../AnnotationImporter';
import {COCOUtils} from './COCOUtils';
import {Settings} from "../../../settings/Settings";
import {FileUtil} from '../../../utils/FileUtil';

export type FileNameCOCOIdMap = {[ fileName: string]: number; }
export type LabelNameMap = { [labelCOCOId: number]: LabelName; }
export type ImageDataMap = { [imageCOCOId: number]: ImageData; }

export class COCOImporter extends AnnotationImporter {
    public static requiredKeys = ['images', 'annotations', 'categories']

    public import(
        filesData: File[],
        onSuccess: (imagesData: ImageData[], labelNames: LabelName[]) => any,
        onFailure: (error?:Error) => any
    ): void {
        if (!filesData || filesData.length === 0) {
            onFailure(new COCOAnnotationReadingError());
            return;
        }

        FileUtil.readFiles(filesData)
            .then((texts: string[]) => {
                const cocoObjects = texts.map((text: string) => COCOImporter.deserialize(text));
                const merged = COCOImporter.mergeCocoObjects(cocoObjects);
                const inputImagesData: ImageData[] = LabelsSelector.getImagesData();
                const {imagesData, labelNames} = this.applyLabels(inputImagesData, merged);
                onSuccess(imagesData, labelNames);
            })
            .catch((error: Error) => onFailure(error));
    }

    public static deserialize(text: string): COCOObject {
        try {
            return JSON.parse(text) as COCOObject
        } catch (error) {
            throw new COCOAnnotationDeserializationError()
        }
    }

    public applyLabels(imageData: ImageData[], annotationsObject: COCOObject): ImportResult {
        COCOImporter.validateCocoFormat(annotationsObject);
        const {images, categories, annotations} = annotationsObject;
        const labelNameMap: LabelNameMap = COCOImporter.mapCOCOCategories(categories);
        const cleanImageData: ImageData[] = imageData.map((item: ImageData) => ImageDataUtil.cleanAnnotations(item));
        const imageDataPartition: PartitionResult<ImageData> = COCOImporter.partitionImageData(cleanImageData, images);
        const imageDataMap: ImageDataMap = COCOImporter.mapImageData(imageDataPartition.pass, images);

        for (const annotation of annotations) {
            if (!imageDataMap[annotation.image_id] || annotation.iscrowd === 1)
                continue

            if (this.labelType.includes(LabelType.RECT)) {
                if (Array.isArray(annotation.bbox) && annotation.bbox.length >= 4 && labelNameMap[annotation.category_id]) {
                    imageDataMap[annotation.image_id].labelRects.push(LabelUtil.createLabelRect(
                        labelNameMap[annotation.category_id].id,
                        COCOUtils.bbox2rect(annotation.bbox)
                    ))
                }
            }

            if (this.labelType.includes(LabelType.POLYGON)) {
                if (Array.isArray(annotation.segmentation) && labelNameMap[annotation.category_id]) {
                    const polygons = COCOUtils.segmentation2vertices(annotation.segmentation);
                    for (const polygon of polygons) {
                        imageDataMap[annotation.image_id].labelPolygons.push(LabelUtil.createLabelPolygon(
                            labelNameMap[annotation.category_id].id, polygon
                        ))
                    }
                }
            }
        }

        const resultImageData = Object.values(imageDataMap).concat(imageDataPartition.fail);

        return {
            imagesData: ImageDataUtil.arrange(resultImageData, imageData.map((item: ImageData) => item.id)),
            labelNames: Object.values(labelNameMap)
        }
    }

    protected static partitionImageData(items: ImageData[], images: COCOImage[]): PartitionResult<ImageData> {
        const imageNames: string[] = images.map((item: COCOImage) => COCOImporter.normalizeFileName(item.file_name));
        const predicate = (item: ImageData) => imageNames.includes(COCOImporter.normalizeFileName(item.fileData.name));
        return ArrayUtil.partition<ImageData>(items, predicate);
    }

    protected static mapCOCOCategories(categories: COCOCategory[]): LabelNameMap {
        return categories.reduce((acc: LabelNameMap, category : COCOCategory, index: number) => {
            acc[category.id] = {
                id: uuidv4(),
                name: category.name,
                color: ArrayUtil.getByInfiniteIndex(Settings.LABEL_COLORS_PALETTE, index)
            }
            return acc
        }, {});
    }

    protected static mapImageData(items: ImageData[], images: COCOImage[]): ImageDataMap {
        const fileNameCOCOIdMap: FileNameCOCOIdMap = images.reduce((acc: FileNameCOCOIdMap, image: COCOImage) => {
            acc[COCOImporter.normalizeFileName(image.file_name)] = image.id
            return acc
        }, {});
        return  items.reduce((acc: ImageDataMap, image: ImageData) => {
            const cocoId = fileNameCOCOIdMap[COCOImporter.normalizeFileName(image.fileData.name)];
            if (cocoId !== undefined) {
                acc[cocoId] = image
            }
            return acc;
        }, {});
    }

    public static validateCocoFormat(annotationsObject: COCOObject): void {
        const missingKeys = COCOImporter.requiredKeys.filter((key: string) => !annotationsObject.hasOwnProperty(key))
        if (missingKeys.length !== 0) {
            throw new COCOFormatValidationError(`Uploaded file does not contain all required keys: ${missingKeys}`)
        }
    }

    private static normalizeFileName(fileName: string): string {
        const normalizedSlashes = `${fileName || ''}`.trim().replace(/\\/g, '/');
        const baseName = normalizedSlashes.split('/').pop() || normalizedSlashes;
        return baseName.toLowerCase();
    }

    private static mergeCocoObjects(objects: COCOObject[]): COCOObject {
        if (!objects.length) {
            throw new COCOAnnotationFileCountError();
        }

        // Merge strategy:
        // - canonical categories keyed by name (case-insensitive)
        // - canonical images keyed by normalized file_name (basename lowercased)
        // - remap each file’s annotation.image_id and annotation.category_id into canonical ids
        const categoryNameToId = new Map<string, number>();
        const categories: COCOCategory[] = [];
        const imageNameToId = new Map<string, number>();
        const images: COCOImage[] = [];
        const annotations: any[] = [];

        let nextCategoryId = 1;
        let nextImageId = 1;
        let nextAnnotationId = 1;

        for (const obj of objects) {
            COCOImporter.validateCocoFormat(obj);

            const catIdMap = new Map<number, number>();
            for (const cat of (obj.categories || [])) {
                const key = `${cat.name || ''}`.trim().toLowerCase();
                let canonicalId = categoryNameToId.get(key);
                if (!canonicalId) {
                    canonicalId = nextCategoryId++;
                    categoryNameToId.set(key, canonicalId);
                    categories.push({id: canonicalId, name: cat.name});
                }
                catIdMap.set(cat.id, canonicalId);
            }

            const imageIdMap = new Map<number, number>();
            for (const img of (obj.images || [])) {
                const normalizedName = COCOImporter.normalizeFileName(img.file_name);
                let canonicalImageId = imageNameToId.get(normalizedName);
                if (!canonicalImageId) {
                    canonicalImageId = nextImageId++;
                    imageNameToId.set(normalizedName, canonicalImageId);
                    images.push({
                        id: canonicalImageId,
                        width: img.width,
                        height: img.height,
                        file_name: img.file_name,
                    });
                }
                imageIdMap.set(img.id, canonicalImageId);
            }

            for (const ann of (obj.annotations || [])) {
                const canonicalImageId = imageIdMap.get(ann.image_id);
                const canonicalCategoryId = catIdMap.get(ann.category_id);
                if (!canonicalImageId || !canonicalCategoryId) {
                    continue;
                }
                annotations.push({
                    ...ann,
                    id: nextAnnotationId++,
                    image_id: canonicalImageId,
                    category_id: canonicalCategoryId,
                });
            }
        }

        return {
            // keep first info if present, but it’s not used by importer
            info: objects[0].info,
            images,
            annotations,
            categories,
        } as COCOObject;
    }
}
