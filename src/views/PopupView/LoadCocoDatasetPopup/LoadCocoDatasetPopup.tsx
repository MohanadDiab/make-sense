import React, {useRef, useState} from 'react';
import './LoadCocoDatasetPopup.scss';
import {GenericYesNoPopup} from '../GenericYesNoPopup/GenericYesNoPopup';
import {TextButton} from '../../Common/TextButton/TextButton';
import {PopupActions} from '../../../logic/actions/PopupActions';
import {ImageData, LabelName} from '../../../store/labels/types';
import {connect} from 'react-redux';
import {updateActiveImageIndex, updateImageData, updateLabelNames} from '../../../store/labels/actionCreators';
import {COCODatasetLoader} from '../../../logic/import/coco/COCODatasetLoader';
import {submitNewNotification} from '../../../store/notifications/actionCreators';
import {NotificationUtil} from '../../../utils/NotificationUtil';
import {Notification} from '../../../data/enums/Notification';
import {NotificationsDataMap} from '../../../data/info/NotificationsData';
import {CocoManualAutosave} from '../../../logic/autosave/CocoManualAutosave';

interface IProps {
    updateImageDataAction: (imageData: ImageData[]) => any;
    updateLabelNamesAction: (labels: LabelName[]) => any;
    updateActiveImageIndexAction: (activeImageIndex: number) => any;
}

const LoadCocoDatasetPopup: React.FC<IProps> = (
    {
        updateImageDataAction,
        updateLabelNamesAction,
        updateActiveImageIndexAction
    }
) => {
    const imagesInputRef = useRef<HTMLInputElement>(null);
    const annotationInputRef = useRef<HTMLInputElement>(null);
    const [selectedImages, setSelectedImages] = useState<File[]>([]);
    const [selectedAnnotation, setSelectedAnnotation] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const preview = COCODatasetLoader.collectPreview(selectedImages);

    const onSelectImageFolder = () => {
        imagesInputRef.current?.click();
    };

    const onSelectAnnotationFile = () => {
        annotationInputRef.current?.click();
    };

    const onImageFolderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files ? Array.from(event.target.files) : [];
        setSelectedImages(files);
        setError(null);
    };

    const onAnnotationFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files && event.target.files.length ? event.target.files[0] : null;
        setSelectedAnnotation(file);
        setError(null);
    };

    const createWarningText = (items: string[]): string => {
        const preview = items.slice(0, 5).join(', ');
        const suffix = items.length > 5 ? ` (+${items.length - 5} more)` : '';
        return `${preview}${suffix}`;
    };

    const onAccept = async () => {
        if (!selectedImages.length || !selectedAnnotation) {
            return;
        }

        try {
            // IMPORTANT:
            // `showSaveFilePicker` must begin during the user gesture. Starting it only after awaiting
            // dataset decoding can silently no-op on Chromium.
            const manualSuggestedName = CocoManualAutosave.getManualSuggestedName(selectedAnnotation.name);
            const pickPromise = CocoManualAutosave.beginPickManualFileHandle(manualSuggestedName);

            setIsLoading(true);

            let manualHandle: FileSystemFileHandle | null | undefined = undefined;
            if (pickPromise) {
                manualHandle = await pickPromise;
                if (!manualHandle) {
                    submitNewNotification(
                        NotificationUtil.createWarningNotification({
                            header: 'Manual autosave not enabled',
                            description: 'You cancelled the save prompt. Autosave/export to *_manual.json will not work until you reload the dataset and choose a save location.'
                        })
                    );
                }
            } else {
                submitNewNotification(
                    NotificationUtil.createWarningNotification({
                        header: 'Browser autosave limitation',
                        description: 'This browser does not support direct-to-disk autosave. Manual file writing will fall back to downloads when you export COCO.'
                    })
                );
            }

            const result = await COCODatasetLoader.load(selectedImages, selectedAnnotation);
            updateImageDataAction(result.imagesData);
            updateLabelNamesAction(result.labelNames);
            if (result.imagesData.length) {
                updateActiveImageIndexAction(0);
            }

            submitNewNotification(
                NotificationUtil.createMessageNotification({
                    header: 'COCO dataset loaded',
                    description: `Loaded ${result.imagesData.length} images and ${result.labelNames.length} labels.`
                })
            );
            submitNewNotification(
                NotificationUtil.createMessageNotification(
                    NotificationsDataMap[Notification.GEOREFERENCING_EXTERNAL_INFO]
                )
            );

            if (result.warnings.missingFromDirectory.length) {
                submitNewNotification(
                    NotificationUtil.createWarningNotification({
                        header: 'Missing COCO images skipped',
                        description: `${result.warnings.missingFromDirectory.length} referenced images were not found in selected directory: ${createWarningText(result.warnings.missingFromDirectory)}`
                    })
                );
            }

            if (result.warnings.imagesWithoutAnnotations.length) {
                submitNewNotification(
                    NotificationUtil.createWarningNotification({
                        header: 'Images without annotations',
                        description: `${result.warnings.imagesWithoutAnnotations.length} selected images were not referenced in COCO and were loaded with empty annotations.`
                    })
                );
            }

            // Start autosave sidecar (_manual.json) for COCO folder projects.
            await CocoManualAutosave.enableForCocoDataset(selectedAnnotation.name, manualHandle || null);

            PopupActions.close();
        } catch (loaderError) {
            const message = loaderError instanceof Error ? loaderError.message : 'Could not load selected dataset.';
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const onReject = () => {
        PopupActions.close();
    };

    const renderContent = () => {
        return <div className='LoadCocoDatasetPopupContent'>
            <input
                ref={imagesInputRef}
                type='file'
                multiple={true}
                onChange={onImageFolderChange}
                // @ts-ignore webkitdirectory is supported in browser but missing in TS DOM types.
                webkitdirectory='true'
                // @ts-ignore directory for Chromium compatibility.
                directory='true'
            />
            <input
                ref={annotationInputRef}
                type='file'
                accept='.json,application/json'
                onChange={onAnnotationFileChange}
            />

            <div className='SelectionCard'>
                <div className='SelectionHeader'>Images Directory</div>
                <div className='SelectionHint'>Select the directory containing dataset images.</div>
                <TextButton
                    label='Choose Image Directory'
                    onClick={onSelectImageFolder}
                    externalClassName='SelectionButton'
                />
                <div className='SelectionMeta'>
                    {selectedImages.length ? `${preview.imageCount} image files selected` : 'No directory selected'}
                </div>
            </div>

            <div className='SelectionCard'>
                <div className='SelectionHeader'>Validation Summary</div>
                <div className='SelectionMeta'>
                    Images ready: {preview.imageCount}
                </div>
                <div className='SelectionMeta'>
                    Annotation file: {selectedAnnotation ? selectedAnnotation.name : 'not selected'}
                </div>
                <div className='SelectionHint'>
                    Geospatial metadata is not exported in this workflow; annotations are saved in standard non-georeferenced formats.
                </div>
            </div>

            <div className='SelectionCard'>
                <div className='SelectionHeader'>COCO Annotation File</div>
                <div className='SelectionHint'>Select a single COCO `.json` annotation file.</div>
                <TextButton
                    label='Choose Annotation File'
                    onClick={onSelectAnnotationFile}
                    externalClassName='SelectionButton'
                />
                <div className='SelectionMeta'>
                    {selectedAnnotation ? selectedAnnotation.name : 'No annotation file selected'}
                </div>
            </div>

            {error && <div className='SelectionMeta'>{error}</div>}
        </div>;
    };

    return (
        <GenericYesNoPopup
            title={'Load COCO dataset'}
            renderContent={renderContent}
            acceptLabel={isLoading ? 'Loading...' : 'Load'}
            disableAcceptButton={isLoading || !selectedImages.length || !selectedAnnotation}
            onAccept={onAccept}
            rejectLabel={'Cancel'}
            disableRejectButton={isLoading}
            onReject={onReject}
        />
    );
};

const mapDispatchToProps = {
    updateImageDataAction: updateImageData,
    updateLabelNamesAction: updateLabelNames,
    updateActiveImageIndexAction: updateActiveImageIndex
};

const mapStateToProps = () => ({});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(LoadCocoDatasetPopup);
