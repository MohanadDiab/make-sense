/**
 * Optional local integration test for a real COCO folder + JSON.
 * Skips automatically when the fixture paths are missing (e.g. on CI).
 *
 * Mirrors rect COCO export shape from CocoManualAutosave.buildCocoFromCurrentState
 * (bbox x,y,w,h + sequential image_id).
 */
import * as fs from 'fs';
import * as path from 'path';
import { COCODatasetLoader } from '../../import/coco/COCODatasetLoader';
import type { ImageData, LabelName } from '../../../store/labels/types';
import { FileDisplayUtil } from '../../../utils/FileDisplayUtil';

const ANNOTATION_JSON = path.join(
    'C:',
    'Users',
    'mohan',
    'Documents',
    'GitHub',
    'anaheim',
    'outputs',
    'coco_rgbi',
    'annotations',
    'instances_valid_final.json'
);
const IMAGE_ROOT = path.join(
    'C:',
    'Users',
    'mohan',
    'Documents',
    'GitHub',
    'anaheim',
    'outputs',
    'coco_rgbi',
    'valid_final'
);

function buildRectManualCocoJson(
    imagesData: ImageData[],
    labelNames: LabelName[],
    description: string
): string {
    const categoryIdByLabelId: Record<string, number> = {};
    labelNames.forEach((ln, idx) => {
        categoryIdByLabelId[ln.id] = idx + 1;
    });

    const images = imagesData.map((img: ImageData, idx: number) => {
        const file_name = FileDisplayUtil.getFilePath(img.fileData).replace(/\\/g, '/');
        const width = img.rasterMeta?.width || 0;
        const height = img.rasterMeta?.height || 0;
        return {
            id: idx + 1,
            width,
            height,
            file_name,
        };
    });

    let annId = 1;
    const annotations: Array<{
        id: number;
        image_id: number;
        category_id: number;
        bbox: number[];
        area: number;
        iscrowd: number;
    }> = [];
    imagesData.forEach((img: ImageData, idx: number) => {
        (img.labelRects || []).forEach((rectLabel) => {
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
                iscrowd: 0,
            });
        });
    });

    const categories = labelNames.map((ln: LabelName, idx: number) => ({
        id: idx + 1,
        name: ln.name,
    }));

    return JSON.stringify({
        info: { description },
        images,
        annotations,
        categories,
    });
}

function fileFromDisk(absPath: string, datasetRoot: string): File {
    const buf = fs.readFileSync(absPath);
    const rel = path.relative(datasetRoot, absPath).replace(/\\/g, '/');
    const file = new File([buf], path.basename(absPath), { type: 'image/tiff' });
    Object.defineProperty(file, 'webkitRelativePath', { value: rel, enumerable: true });
    return file;
}

function rectsMatchBBox(
    r: { x: number; y: number; width: number; height: number },
    bbox: number[]
): boolean {
    return (
        Math.abs(r.x - bbox[0]) < 1e-2 &&
        Math.abs(r.y - bbox[1]) < 1e-2 &&
        Math.abs(r.width - bbox[2]) < 1e-2 &&
        Math.abs(r.height - bbox[3]) < 1e-2
    );
}

const fixturesPresent = fs.existsSync(ANNOTATION_JSON) && fs.existsSync(IMAGE_ROOT);

describe('Anaheim COCO load + rect export round-trip (local fixtures)', () => {
    const run = fixturesPresent ? it : it.skip;

    run(
        'loads bbox annotations for one chip and export reflects an edited bbox',
        async () => {
            const raw = fs.readFileSync(ANNOTATION_JSON, 'utf8');
            const coco: {
                images: Array<{ id: number; file_name: string; width: number; height: number }>;
                annotations: Array<{
                    id: number;
                    image_id: number;
                    category_id: number;
                    bbox: number[];
                    iscrowd?: number;
                }>;
                categories: Array<{ id: number; name: string }>;
            } = JSON.parse(raw);

            const annotatedImageIds = new Set(
                coco.annotations.filter((a) => a.iscrowd !== 1).map((a) => a.image_id)
            );
            const targetCocoImage = coco.images.find((im) => annotatedImageIds.has(im.id));
            expect(targetCocoImage).toBeDefined();

            const absImage = path.join(IMAGE_ROOT, ...targetCocoImage!.file_name.split('/'));
            expect(fs.existsSync(absImage)).toBe(true);

            const expectedAnnos = coco.annotations.filter(
                (a) => a.image_id === targetCocoImage!.id && a.iscrowd !== 1
            );
            expect(expectedAnnos.length).toBeGreaterThan(0);

            const annFile = new File([raw], path.basename(ANNOTATION_JSON), { type: 'application/json' });
            const imageFile = fileFromDisk(absImage, IMAGE_ROOT);

            const { imagesData, labelNames } = await COCODatasetLoader.load([imageFile], annFile);

            expect(imagesData.length).toBe(1);
            expect(labelNames.length).toBe(coco.categories.length);
            expect(labelNames[0].name).toBe(coco.categories[0].name);

            const chip = imagesData[0];
            const matchedRects = chip.labelRects.filter((lr) =>
                expectedAnnos.some((anno) => rectsMatchBBox(lr.rect, anno.bbox))
            );
            expect(matchedRects.length).toBe(expectedAnnos.length);

            for (const anno of expectedAnnos) {
                const match = chip.labelRects.find((lr) => rectsMatchBBox(lr.rect, anno.bbox));
                expect(match).toBeDefined();
            }

            const DELTA = 42;
            const firstBbox = expectedAnnos[0].bbox;
            const firstRect = chip.labelRects.find((lr) => rectsMatchBBox(lr.rect, firstBbox));
            expect(firstRect).toBeDefined();
            const beforeX = firstRect!.rect.x;
            firstRect!.rect = {
                ...firstRect!.rect,
                x: beforeX + DELTA,
            };
            chip.rasterMeta = {
                width: targetCocoImage!.width,
                height: targetCocoImage!.height,
                bandCount: 4,
            };

            const out = JSON.parse(buildRectManualCocoJson(imagesData, labelNames, 'roundtrip-test'));

            expect(out.images.length).toBe(1);
            expect(out.annotations.length).toBe(chip.labelRects.length);
            const exported = out.annotations.find(
                (a: { bbox: number[] }) => Math.abs(a.bbox[0] - (beforeX + DELTA)) < 1e-2
            );
            expect(exported).toBeDefined();
            expect(exported.category_id).toBe(1);
        },
        120000
    );
});
