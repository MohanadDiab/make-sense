import {LabelType} from '../../data/enums/LabelType';
import {LabelsSelector} from '../../store/selectors/LabelsSelector';
import {AISSDObjectDetectionActions} from './AISSDObjectDetectionActions';
import {AIPoseDetectionActions} from './AIPoseDetectionActions';
import {ImageData} from '../../store/labels/types';
import {AISelector} from '../../store/selectors/AISelector';
import {AIYOLOObjectDetectionActions} from './AIYOLOObjectDetectionActions';
import { AIRoboflowAPIObjectDetectionActions } from './AIRoboflowAPIObjectDetectionActions';
import {TIFFUtil} from '../../utils/TIFFUtil';
import {store} from '../../index';
import {updateImageDataById} from '../../store/labels/actionCreators';
import {submitNewNotification} from '../../store/notifications/actionCreators';
import {NotificationUtil} from '../../utils/NotificationUtil';

export class AIActions {
    public static excludeRejectedLabelNames(suggestedLabels: string[], rejectedLabels: string[]): string[] {
        return suggestedLabels.reduce((acc: string[], label: string) => {
            if (!rejectedLabels.includes(label)) {
                acc.push(label)
            }
            return acc;
        }, [])
    }

    public static detect(imageId: string, image: HTMLImageElement): void {
        const imageData =  LabelsSelector.getImageDataById(imageId)
        const activeLabelType: LabelType = LabelsSelector.getActiveLabelType();
        if (AIActions.isTiffImage(imageData)) {
            AIActions.markTiffImageAsVisitedByAI(imageData, activeLabelType);
            store.dispatch(submitNewNotification(NotificationUtil.createWarningNotification({
                header: 'AI disabled for TIFF display mode',
                description: 'AI auto-detection is currently disabled for TIFF images. You can continue labeling manually.'
            })));
            return;
        }
        const isAIYOLOObjectDetectorModelLoaded = AISelector.isAIYOLOObjectDetectorModelLoaded();
        const isAISSDObjectDetectorModelLoaded = AISelector.isAISSDObjectDetectorModelLoaded();
        const isRoboflowAPIModelLoaded = AISelector.isRoboflowAPIModelLoaded();
        switch (activeLabelType) {
            case LabelType.RECT:
                if (isAISSDObjectDetectorModelLoaded) {
                    AISSDObjectDetectionActions.detectRects(imageId, image);
                }
                if (isAIYOLOObjectDetectorModelLoaded) {
                    AIYOLOObjectDetectionActions.detectRects(imageId, image);
                }
                if (isRoboflowAPIModelLoaded) {
                    AIRoboflowAPIObjectDetectionActions.detectRects(imageData)
                }
                break;
            case LabelType.POINT:
                AIPoseDetectionActions.detectPoses(imageId, image);
                break;
        }
    }

    public static rejectAllSuggestedLabels(imageData: ImageData) {
        const activeLabelType: LabelType = LabelsSelector.getActiveLabelType();
        const isAIYOLOObjectDetectorModelLoaded = AISelector.isAIYOLOObjectDetectorModelLoaded();
        const isAISSDObjectDetectorModelLoaded = AISelector.isAISSDObjectDetectorModelLoaded();
        const isRoboflowAPIModelLoaded = AISelector.isRoboflowAPIModelLoaded();
        switch (activeLabelType) {
            case LabelType.RECT:
                if (isAISSDObjectDetectorModelLoaded) {
                    AISSDObjectDetectionActions.rejectAllSuggestedRectLabels(imageData);
                }
                if (isAIYOLOObjectDetectorModelLoaded) {
                    AIYOLOObjectDetectionActions.rejectAllSuggestedRectLabels(imageData);
                }
                if (isRoboflowAPIModelLoaded) {
                    AIRoboflowAPIObjectDetectionActions.rejectAllSuggestedRectLabels(imageData)
                }
                break;
            case LabelType.POINT:
                AIPoseDetectionActions.rejectAllSuggestedPointLabels(imageData);
                break;
        }
    }

    public static acceptAllSuggestedLabels(imageData: ImageData) {
        const activeLabelType: LabelType = LabelsSelector.getActiveLabelType();
        const isAIYOLOObjectDetectorModelLoaded = AISelector.isAIYOLOObjectDetectorModelLoaded();
        const isAISSDObjectDetectorModelLoaded = AISelector.isAISSDObjectDetectorModelLoaded();
        const isRoboflowAPIModelLoaded = AISelector.isRoboflowAPIModelLoaded();
        switch (activeLabelType) {
            case LabelType.RECT:
                if (isAISSDObjectDetectorModelLoaded) {
                    AISSDObjectDetectionActions.acceptAllSuggestedRectLabels(imageData);
                }
                if (isAIYOLOObjectDetectorModelLoaded) {
                    AIYOLOObjectDetectionActions.acceptAllSuggestedRectLabels(imageData);
                }
                if (isRoboflowAPIModelLoaded) {
                    AIRoboflowAPIObjectDetectionActions.acceptAllSuggestedRectLabels(imageData)
                }
                break;
            case LabelType.POINT:
                AIPoseDetectionActions.acceptAllSuggestedPointLabels(imageData);
                break;
        }
    }

    private static isTiffImage(imageData: ImageData): boolean {
        return TIFFUtil.isTiffFile(imageData.fileData);
    }

    private static markTiffImageAsVisitedByAI(imageData: ImageData, labelType: LabelType): void {
        if (labelType === LabelType.RECT) {
            if (imageData.isVisitedBySSDObjectDetector
                && imageData.isVisitedByYOLOObjectDetector
                && imageData.isVisitedByRoboflowAPI) {
                return;
            }
            store.dispatch(updateImageDataById(imageData.id, {
                ...imageData,
                isVisitedBySSDObjectDetector: true,
                isVisitedByYOLOObjectDetector: true,
                isVisitedByRoboflowAPI: true
            }));
            return;
        }

        if (labelType === LabelType.POINT && !imageData.isVisitedByPoseDetector) {
            store.dispatch(updateImageDataById(imageData.id, {
                ...imageData,
                isVisitedByPoseDetector: true
            }));
        }
    }
}
