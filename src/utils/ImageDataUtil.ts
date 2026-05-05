import {ImageData, ImageSourceType, TiffDisplayPreset} from '../store/labels/types';
import { v4 as uuidv4 } from 'uuid';
import {FileUtil} from './FileUtil';
import {ImageRepository} from '../logic/imageRepository/ImageRepository';
import {TIFFUtil} from './TIFFUtil';

export class ImageDataUtil {
    public static createImageDataFromFileData(fileData: File): ImageData {
        const isTiff = TIFFUtil.isTiffFile(fileData);
        return {
            id: uuidv4(),
            fileData,
            sourceType: isTiff ? ImageSourceType.TIFF : ImageSourceType.STANDARD,
            displayBands: isTiff ? [0, 1, 2] : undefined,
            displayPreset: isTiff ? TiffDisplayPreset.RGB : undefined,
            loadStatus: false,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: [],
            isVisitedByYOLOObjectDetector: false,
            isVisitedBySSDObjectDetector: false,
            isVisitedByPoseDetector: false,
            isVisitedByRoboflowAPI: false
        }
    }

    public static cleanAnnotations(item: ImageData): ImageData {
        return {
            ...item,
            labelRects: [],
            labelPoints: [],
            labelLines: [],
            labelPolygons: [],
            labelNameIds: []
        }
    }

    public static arrange(items: ImageData[], idArrangement: string[]): ImageData[] {
        return items.sort((a: ImageData, b: ImageData) => {
            return idArrangement.indexOf(a.id) - idArrangement.indexOf(b.id)
        })
    }

    public static loadMissingImages(images: ImageData[]): Promise<void> {
        return new Promise((resolve, reject) => {
            const missingImages = images.filter((i: ImageData) => !i.loadStatus);
            const promises = missingImages.map((i: ImageData) => FileUtil.loadRenderableImage(i));
            Promise.all(promises)
                .then((htmlImageElements:HTMLImageElement[]) => {
                    ImageRepository.storeImages(missingImages.map((i: ImageData) => i.id), htmlImageElements);
                    resolve()
                })
                .catch((error: Error) => reject(error));
        });
    }
}
