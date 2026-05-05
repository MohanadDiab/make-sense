import {COCODatasetLoader} from '../../../import/coco/COCODatasetLoader';

const createImage = (name: string): File => new File(['img'], name, {type: 'image/png'});

describe('COCODatasetLoader collectPreview', () => {
    it('counts only supported image files', () => {
        const result = COCODatasetLoader.collectPreview([
            createImage('a.png'),
            new File(['x'], 'notes.txt', {type: 'text/plain'}),
            createImage('b.jpg')
        ]);

        expect(result.imageCount).toBe(2);
    });
});

describe('COCODatasetLoader load', () => {
    it('matches COCO image names case-insensitively and by basename when unique', async () => {
        const annotation = {
            images: [
                {id: 1, file_name: 'train/A.png', width: 10, height: 10}
            ],
            categories: [
                {id: 1, name: 'car'}
            ],
            annotations: [
                {id: 1, image_id: 1, category_id: 1, bbox: [1, 2, 3, 4], segmentation: [], area: 12, iscrowd: 0}
            ]
        };

        const annotationFile = new File([JSON.stringify(annotation)], 'instances.json', {type: 'application/json'});
        const result = await COCODatasetLoader.load(
            [
                createImage('A.png'),
                createImage('extra.png')
            ],
            annotationFile
        );

        expect(result.imagesData.length).toBe(2);
        expect(result.labelNames.length).toBe(1);
        expect(result.warnings.missingFromDirectory).toEqual([]);
        expect(result.warnings.imagesWithoutAnnotations).toEqual(['extra.png']);
        expect(result.imagesData[0].labelRects.length + result.imagesData[1].labelRects.length).toBe(1);
    });

    it('does not crash when segmentation is missing (bbox-only COCO)', async () => {
        const annotation = {
            images: [
                {id: 1, file_name: 'train/a.png', width: 10, height: 10}
            ],
            categories: [
                {id: 1, name: 'car'}
            ],
            annotations: [
                {id: 1, image_id: 1, category_id: 1, bbox: [1, 2, 3, 4], area: 12, iscrowd: 0}
            ]
        };

        const annotationFile = new File([JSON.stringify(annotation)], 'instances.json', {type: 'application/json'});
        const result = await COCODatasetLoader.load([createImage('a.png')], annotationFile);
        expect(result.imagesData.length).toBe(1);
        expect(result.imagesData[0].labelRects.length).toBe(1);
    });

    it('uses last-parent+filename matching to avoid basename collisions', async () => {
        const annotation = {
            images: [
                {id: 1, file_name: 'urban/tileA/r0_c0.tif', width: 10, height: 10}
            ],
            categories: [
                {id: 1, name: 'car'}
            ],
            annotations: [
                {id: 1, image_id: 1, category_id: 1, bbox: [1, 2, 3, 4], area: 12, iscrowd: 0}
            ]
        };

        const a = new File(['img'], 'r0_c0.tif', {type: 'image/tiff'}) as any;
        a.webkitRelativePath = 'tileA/r0_c0.tif';
        const b = new File(['img'], 'r0_c0.tif', {type: 'image/tiff'}) as any;
        b.webkitRelativePath = 'tileB/r0_c0.tif';

        const annotationFile = new File([JSON.stringify(annotation)], 'instances.json', {type: 'application/json'});
        const result = await COCODatasetLoader.load([a, b], annotationFile);
        const labeledCounts = result.imagesData.map((i) => i.labelRects.length);
        expect(labeledCounts.filter((c) => c === 1).length).toBe(1);
    });
});
