import { ImageData, ImageSourceType, TiffDisplayPreset } from '../../store/labels/types';
import { v4 as uuidv4 } from 'uuid';
import { LabelUtil } from '../LabelUtil';
import { ImageDataUtil } from '../ImageDataUtil';
import { AcceptedFileType } from '../../data/enums/AcceptedFileType';


const getDummyImageData = (id: string): ImageData => {
    return {
        id,
        fileData: new File([''], 'filename.txt', { type: AcceptedFileType.TEXT }),
        loadStatus: true,
        labelRects: [],
        labelPoints: [],
        labelLines: [],
        labelPolygons: [],
        labelNameIds: [],
        isVisitedByYOLOObjectDetector: false,
        isVisitedBySSDObjectDetector: false,
        isVisitedByPoseDetector: false,
        isVisitedByRoboflowAPI: false
    };
};


describe('ImageDataUtil cleanAnnotation method', () => {
    it('should return new ImageData object without annotations', () => {
        // given
        const item: ImageData = getDummyImageData(uuidv4());
        item.labelRects = [
            LabelUtil.createLabelRect('label-id', { x: 1, y: 1, width: 1, height: 1 }),
            LabelUtil.createLabelRect('label-id', { x: 1, y: 1, width: 1, height: 1 })
        ];

        // when
        const result = ImageDataUtil.cleanAnnotations(item);

        // then
        expect(result.labelRects.length).toEqual(0);
        expect(item.labelRects.length).toEqual(2);
    });
});

describe('ImageDataUtil arrange method', () => {
    it('should return new array with correctly arranged ImageData objects', () => {
        // given
        const idA = uuidv4(), idB = uuidv4(), idC = uuidv4(), idD = uuidv4();
        const givenIdArrangement = [idD, idA, idB, idC];
        const expectedIdArrangement = [idA, idB, idC, idD];
        const items = givenIdArrangement.map((id: string) => getDummyImageData(id));

        // when
        const result = ImageDataUtil.arrange(items, expectedIdArrangement);
        const resultIdArrangement = result.map((item: ImageData) => item.id);

        // then
        expect(JSON.stringify(expectedIdArrangement)).toBe(JSON.stringify(resultIdArrangement));
    });
});

describe('ImageDataUtil createImageDataFromFileData method', () => {
    it('sets TIFF defaults for .tif files', () => {
        const fileData = new File([''], 'aerial_scene.tif', { type: 'image/tiff' });

        const result = ImageDataUtil.createImageDataFromFileData(fileData);

        expect(result.sourceType).toBe(ImageSourceType.TIFF);
        expect(result.displayPreset).toBe(TiffDisplayPreset.RGB);
        expect(result.displayBands).toEqual([0, 1, 2]);
    });

    it('sets standard defaults for png files', () => {
        const fileData = new File([''], 'photo.png', { type: 'image/png' });

        const result = ImageDataUtil.createImageDataFromFileData(fileData);

        expect(result.sourceType).toBe(ImageSourceType.STANDARD);
        expect(result.displayPreset).toBeUndefined();
        expect(result.displayBands).toBeUndefined();
    });
});
