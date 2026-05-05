import {labelsReducer} from './reducer';
import {Action} from '../Actions';
import {DualViewSyncConflictPolicy, DualViewSyncDirection, ImageData} from './types';
import {LabelStatus} from '../../data/enums/LabelStatus';

const createImageData = (id: string, fileName: string): ImageData => ({
    id,
    fileData: new File([''], fileName, {type: 'image/png'}),
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
});

describe('labelsReducer dual view behavior', () => {
    it('builds image pair map from normalized file names', () => {
        const first = createImageData('1', 'Scene_A.png');
        const second = createImageData('2', 'scene_a.png');
        const third = createImageData('3', 'other.png');

        const state = labelsReducer(undefined, {
            type: Action.UPDATE_IMAGES_DATA,
            payload: {
                imageData: [first, second, third]
            }
        });

        expect(state.imagePairById[first.id]).toBe(second.id);
        expect(state.imagePairById[second.id]).toBe(first.id);
        expect(state.imagePairById[third.id]).toBeUndefined();
    });

    it('mirrors annotations to paired image when dual sync enabled', () => {
        const first = createImageData('1', 'scene_a.png');
        const second = createImageData('2', 'scene_a.png');

        const withImages = labelsReducer(undefined, {
            type: Action.UPDATE_IMAGES_DATA,
            payload: {
                imageData: [first, second]
            }
        });

        const syncOn = labelsReducer(withImages, {
            type: Action.UPDATE_DUAL_VIEW_SYNC_ENABLED,
            payload: {
                dualViewSyncEnabled: true
            }
        });

        const updatedFirst: ImageData = {
            ...first,
            labelRects: [{
                id: 'rect-1',
                labelId: null,
                isVisible: true,
                rect: {x: 1, y: 2, width: 3, height: 4},
                isCreatedByAI: false,
                status: LabelStatus.ACCEPTED,
                suggestedLabel: ''
            }]
        };

        const result = labelsReducer(syncOn, {
            type: Action.UPDATE_IMAGE_DATA_BY_ID,
            payload: {
                id: first.id,
                newImageData: updatedFirst
            }
        });

        const paired = result.imagesData.find((image: ImageData) => image.id === second.id);
        expect(paired.labelRects.length).toBe(1);
        expect(paired.labelRects[0].rect).toEqual({x: 1, y: 2, width: 3, height: 4});
    });

    it('updates sync direction and conflict policy settings', () => {
        const base = labelsReducer(undefined, {
            type: Action.UPDATE_DUAL_VIEW_SYNC_DIRECTION,
            payload: {
                dualViewSyncDirection: DualViewSyncDirection.BIDIRECTIONAL
            }
        });

        const updated = labelsReducer(base, {
            type: Action.UPDATE_DUAL_VIEW_SYNC_CONFLICT_POLICY,
            payload: {
                dualViewSyncConflictPolicy: DualViewSyncConflictPolicy.LAST_WRITE_WINS
            }
        });

        expect(updated.dualViewSyncDirection).toBe(DualViewSyncDirection.BIDIRECTIONAL);
        expect(updated.dualViewSyncConflictPolicy).toBe(DualViewSyncConflictPolicy.LAST_WRITE_WINS);
    });
});
