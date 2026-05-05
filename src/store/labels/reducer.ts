import {DualViewSyncConflictPolicy, DualViewSyncDirection, LabelsActionTypes, LabelsState, ImageData} from './types';
import {Action} from '../Actions';

const initialState: LabelsState = {
    activeImageIndex: null,
    activeLabelNameId: null,
    activeLabelType: null,
    activeLabelId: null,
    highlightedLabelId: null,
    imagesData: [],
    annotationsRevision: 0,
    imagePairById: {},
    dualViewEnabled: false,
    dualViewSyncEnabled: false,
    dualViewSyncDirection: DualViewSyncDirection.ACTIVE_TO_LINKED,
    dualViewSyncConflictPolicy: DualViewSyncConflictPolicy.LAST_WRITE_WINS,
    firstLabelCreatedFlag: false,
    labels: []
};

export function labelsReducer(
    state = initialState,
    action: LabelsActionTypes
): LabelsState {
    const safeImagesData: ImageData[] = normalizeImagesData(state.imagesData || []);
    switch (action.type) {
        case Action.UPDATE_ACTIVE_IMAGE_INDEX: {
            return {
                ...state,
                activeImageIndex: action.payload.activeImageIndex
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_NAME_ID: {
            return {
                ...state,
                activeLabelNameId: action.payload.activeLabelNameId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_ID: {
            return {
                ...state,
                activeLabelId: action.payload.activeLabelId
            }
        }
        case Action.UPDATE_HIGHLIGHTED_LABEL_ID: {
            return {
                ...state,
                highlightedLabelId: action.payload.highlightedLabelId
            }
        }
        case Action.UPDATE_ACTIVE_LABEL_TYPE: {
            return {
                ...state,
                activeLabelType: action.payload.activeLabelType
            }
        }
        case Action.UPDATE_IMAGE_DATA_BY_ID: {
            const normalizedNewImageData = normalizeImageData(action.payload.newImageData);
            const nextImagesData = safeImagesData.map((imageData: ImageData) =>
                imageData.id === action.payload.id ? normalizedNewImageData : imageData
            );
            if (state.dualViewSyncEnabled) {
                const pairedId = state.imagePairById[action.payload.id];
                if (pairedId) {
                    const source = normalizedNewImageData;
                    const synchronized = nextImagesData.map((imageData: ImageData) => imageData.id === pairedId
                        ? {
                            ...imageData,
                            labelRects: [...(source.labelRects || [])],
                            labelPoints: [...(source.labelPoints || [])],
                            labelLines: [...(source.labelLines || [])],
                            labelPolygons: [...(source.labelPolygons || [])]
                        }
                        : imageData);
                    return {
                        ...state,
                        imagesData: synchronized
                    }
                }
            }
            return {
                ...state,
                imagesData: nextImagesData,
                annotationsRevision: (state.annotationsRevision || 0) + 1
            }
        }
        case Action.ADD_IMAGES_DATA: {
            const imagesData = safeImagesData.concat(normalizeImagesData(action.payload.imageData || []));
            return {
                ...state,
                imagesData,
                imagePairById: buildImagePairMap(imagesData),
                annotationsRevision: (state.annotationsRevision || 0) + 1
            }
        }
        case Action.UPDATE_IMAGES_DATA: {
            const imagesData = normalizeImagesData(action.payload.imageData || []);
            return {
                ...state,
                imagesData,
                imagePairById: buildImagePairMap(imagesData),
                annotationsRevision: (state.annotationsRevision || 0) + 1
            }
        }
        case Action.UPDATE_LABEL_NAMES: {
            return {
                ...state,
                labels: action.payload.labels
            }
        }
        case Action.UPDATE_FIRST_LABEL_CREATED_FLAG: {
            return {
                ...state,
                firstLabelCreatedFlag: action.payload.firstLabelCreatedFlag
            }
        }
        case Action.UPDATE_DUAL_VIEW_ENABLED: {
            return {
                ...state,
                dualViewEnabled: action.payload.dualViewEnabled
            }
        }
        case Action.UPDATE_DUAL_VIEW_SYNC_ENABLED: {
            return {
                ...state,
                dualViewSyncEnabled: action.payload.dualViewSyncEnabled
            }
        }
        case Action.UPDATE_DUAL_VIEW_SYNC_DIRECTION: {
            return {
                ...state,
                dualViewSyncDirection: action.payload.dualViewSyncDirection
            }
        }
        case Action.UPDATE_DUAL_VIEW_SYNC_CONFLICT_POLICY: {
            return {
                ...state,
                dualViewSyncConflictPolicy: action.payload.dualViewSyncConflictPolicy
            }
        }
        default:
            return state;
    }
}

const normalizeImageData = (imageData: ImageData): ImageData => {
    if (!imageData) {
        return imageData;
    }
    return {
        ...imageData,
        labelRects: imageData.labelRects || [],
        labelPoints: imageData.labelPoints || [],
        labelLines: imageData.labelLines || [],
        labelPolygons: imageData.labelPolygons || [],
        labelNameIds: imageData.labelNameIds || []
    };
}

const normalizeImagesData = (imagesData: ImageData[]): ImageData[] => {
    return (imagesData || []).map((imageData: ImageData) => normalizeImageData(imageData));
}

const buildImagePairMap = (imagesData: ImageData[]): {[imageId: string]: string} => {
    const groupedByFileName: {[normalizedName: string]: ImageData[]} = {};
    (imagesData || []).forEach((imageData: ImageData) => {
        if (!imageData || !imageData.fileData || !imageData.fileData.name) {
            return;
        }
        const normalizedFileName = imageData.fileData.name.trim().toLowerCase();
        groupedByFileName[normalizedFileName] = groupedByFileName[normalizedFileName] || [];
        groupedByFileName[normalizedFileName].push(imageData);
    });

    return Object.keys(groupedByFileName).reduce((acc: {[imageId: string]: string}, key: string) => {
        const group = groupedByFileName[key];
        if (group.length < 2) {
            return acc;
        }
        const first = group[0];
        const second = group[1];
        acc[first.id] = second.id;
        acc[second.id] = first.id;
        return acc;
    }, {});
}
