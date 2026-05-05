import { ContextType } from '../../../data/enums/ContextType';
import './EditorTopNavigationBar.scss';
import React from 'react';
import classNames from 'classnames';
import { AppState } from '../../../store';
import { connect } from 'react-redux';
import { updateCrossHairVisibleStatus, updateImageDragModeStatus } from '../../../store/general/actionCreators';
import { GeneralSelector } from '../../../store/selectors/GeneralSelector';
import { ViewPointSettings } from '../../../settings/ViewPointSettings';
import { ImageButton } from '../../Common/ImageButton/ImageButton';
import { ViewPortActions } from '../../../logic/actions/ViewPortActions';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { LabelType } from '../../../data/enums/LabelType';
import { AISelector } from '../../../store/selectors/AISelector';
import { ISize } from '../../../interfaces/ISize';
import { AIActions } from '../../../logic/actions/AIActions';
import { Fade, styled, Tooltip, tooltipClasses, TooltipProps } from '@mui/material';
import {
    DualViewSyncConflictPolicy,
    DualViewSyncDirection,
    ImageData,
    ImageSourceType,
    TiffDisplayPreset
} from '../../../store/labels/types';
import {
    updateDualViewEnabled,
    updateDualViewSyncConflictPolicy,
    updateDualViewSyncDirection,
    updateDualViewSyncEnabled,
    updateImageDataById
} from '../../../store/labels/actionCreators';
import {TIFFUtil} from '../../../utils/TIFFUtil';
const BUTTON_SIZE: ISize = { width: 30, height: 30 };
const BUTTON_PADDING: number = 10;

const StyledTooltip = styled(({ className, ...props }: TooltipProps) => (
    <Tooltip {...props} classes={{ popper: className }} />
  ))(({ theme }) => ({
    [`& .${tooltipClasses.tooltip}`]: {
        backgroundColor: '#171717',
        color: '#ffffff',
        boxShadow: theme.shadows[1],
        fontSize: 12,
        maxWidth: 200,
        textAlign: 'center'
    },
  }));

const getButtonWithTooltip = (
    key: string,
    tooltipMessage: string,
    imageSrc: string,
    imageAlt: string,
    isActive: boolean,
    href?: string,
    onClick?: () => any
): React.ReactElement => {
    return <StyledTooltip
        key={key}
        disableFocusListener={true}
        title={tooltipMessage}
        TransitionComponent={Fade}
        TransitionProps={{ timeout: 600 }}
        placement='bottom'
    >
        <div>
            <ImageButton
                buttonSize={BUTTON_SIZE}
                padding={BUTTON_PADDING}
                image={imageSrc}
                imageAlt={imageAlt}
                href={href}
                onClick={onClick}
                isActive={isActive}
            />
        </div>
    </StyledTooltip>;
};

interface IProps {
    activeContext: ContextType;
    updateImageDragModeStatusAction: (imageDragMode: boolean) => any;
    updateCrossHairVisibleStatusAction: (crossHairVisible: boolean) => any;
    updateImageDataByIdAction: (id: string, newImageData: ImageData) => any;
    updateDualViewEnabledAction: (dualViewEnabled: boolean) => any;
    updateDualViewSyncEnabledAction: (dualViewSyncEnabled: boolean) => any;
    updateDualViewSyncDirectionAction: (dualViewSyncDirection: DualViewSyncDirection) => any;
    updateDualViewSyncConflictPolicyAction: (dualViewSyncConflictPolicy: DualViewSyncConflictPolicy) => any;
    imageDragMode: boolean;
    crossHairVisible: boolean;
    dualViewEnabled: boolean;
    dualViewSyncEnabled: boolean;
    dualViewSyncDirection: DualViewSyncDirection;
    dualViewSyncConflictPolicy: DualViewSyncConflictPolicy;
    hasPairedImage: boolean;
    pairedImageName: string | null;
    activeLabelType: LabelType;
    activeImageData: ImageData | null;
}

const EditorTopNavigationBar: React.FC<IProps> = (
    {
        activeContext,
        updateImageDragModeStatusAction,
        updateCrossHairVisibleStatusAction,
        updateImageDataByIdAction,
        updateDualViewEnabledAction,
        updateDualViewSyncEnabledAction,
        updateDualViewSyncDirectionAction,
        updateDualViewSyncConflictPolicyAction,
        imageDragMode,
        crossHairVisible,
        dualViewEnabled,
        dualViewSyncEnabled,
        dualViewSyncDirection,
        dualViewSyncConflictPolicy,
        hasPairedImage,
        pairedImageName,
        activeLabelType,
        activeImageData
    }) => {
    const getClassName = () => {
        return classNames(
            'EditorTopNavigationBar',
            {
                'with-context': activeContext === ContextType.EDITOR
            }
        );
    };

    const imageDragOnClick = () => {
        if (imageDragMode) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
        else if (GeneralSelector.getZoom() !== ViewPointSettings.MIN_ZOOM) {
            updateImageDragModeStatusAction(!imageDragMode);
        }
    };

    const crossHairOnClick = () => {
        updateCrossHairVisibleStatusAction(!crossHairVisible);
    };

    const dualViewOnClick = () => {
        if (!hasPairedImage) {
            return;
        }
        updateDualViewEnabledAction(!dualViewEnabled);
    };

    const dualViewSyncOnClick = () => {
        updateDualViewSyncEnabledAction(!dualViewSyncEnabled);
    };

    const toggleSyncDirection = () => {
        const next = dualViewSyncDirection === DualViewSyncDirection.ACTIVE_TO_LINKED
            ? DualViewSyncDirection.BIDIRECTIONAL
            : DualViewSyncDirection.ACTIVE_TO_LINKED;
        updateDualViewSyncDirectionAction(next);
    };

    const toggleConflictPolicy = () => {
        updateDualViewSyncConflictPolicyAction(DualViewSyncConflictPolicy.LAST_WRITE_WINS);
    };

    const withAI = (
        (activeLabelType === LabelType.RECT && AISelector.isAISSDObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isAIYOLOObjectDetectorModelLoaded()) ||
        (activeLabelType === LabelType.RECT && AISelector.isRoboflowAPIModelLoaded()) ||
        (activeLabelType === LabelType.POINT && AISelector.isAIPoseDetectorModelLoaded())
    )

    const activeBandCount = activeImageData?.rasterMeta?.bandCount ?? 0;
    const isTiffImage = activeImageData
        && (activeImageData.sourceType === ImageSourceType.TIFF || TIFFUtil.isTiffFile(activeImageData.fileData));
    const defaultBandCount = Math.max(1, Math.min(activeBandCount || 3, 3));
    const currentBands = activeImageData?.displayBands?.length
        ? activeImageData.displayBands
        : [...Array(defaultBandCount).keys()];

    const setDisplayBands = (bands: number[], preset: TiffDisplayPreset = TiffDisplayPreset.CUSTOM) => {
        if (!activeImageData) {
            return;
        }
        const validBands = Array.from(new Set(
            bands.filter((band) => band >= 0 && (!activeBandCount || band < activeBandCount))
        ));
        if (validBands.length === 0) {
            return;
        }
        updateImageDataByIdAction(activeImageData.id, {
            ...activeImageData,
            displayBands: validBands,
            displayPreset: preset,
            loadStatus: false
        });
    };

    const toggleBand = (bandIndex: number) => {
        if (!activeBandCount) {
            return;
        }
        const nextBands = currentBands.includes(bandIndex)
            ? currentBands.filter((band) => band !== bandIndex)
            : currentBands.concat(bandIndex);
        if (nextBands.length === 0 || nextBands.length > 4) {
            return;
        }
        setDisplayBands(nextBands, TiffDisplayPreset.CUSTOM);
    };

    const renderTiffBandControls = () => {
        if (!isTiffImage) {
            return null;
        }
        const bandButtons = [...Array(Math.max(1, activeBandCount || 4)).keys()].map((bandIndex) => {
            const isActive = currentBands.includes(bandIndex);
            return <button
                className={classNames('BandToggle', {'active': isActive})}
                key={`band-${bandIndex}`}
                onClick={() => toggleBand(bandIndex)}
                type='button'
            >
                {bandIndex + 1}
            </button>
        });

        const presetButtons = [
            {
                label: 'RGB',
                preset: TiffDisplayPreset.RGB,
                bands: [0, 1, 2],
                visible: activeBandCount >= 3,
                hint: 'Display bands 1,2,3 as Red,Green,Blue.'
            },
            {
                label: '1-2',
                preset: TiffDisplayPreset.BAND_12,
                bands: [0, 1],
                visible: activeBandCount >= 2,
                hint: 'Display bands 1 and 2 with blended blue.'
            },
            {
                label: 'NRG',
                preset: TiffDisplayPreset.NRG,
                bands: [3, 0, 1],
                visible: activeBandCount >= 4,
                hint: 'False color: NIR->Red, Red->Green, Green->Blue.'
            },
            {
                label: '1-4',
                preset: TiffDisplayPreset.BAND_14,
                bands: [0, 1, 2, 3],
                visible: activeBandCount >= 4,
                hint: 'Display first four bands with 4th as luminance boost.'
            }
        ].filter((entry) => entry.visible);

        return <div className='BandSelectionWrapper'>
            <span className='BandSelectionLabel'>Bands:</span>
            <div className='BandButtonList'>
                {bandButtons}
            </div>
            <span className='BandSelectionMeta'>
                {currentBands.length}/4 selected
            </span>
            {presetButtons.map((entry) => <StyledTooltip
                key={entry.preset}
                disableFocusListener={true}
                title={entry.hint}
                TransitionComponent={Fade}
                TransitionProps={{ timeout: 600 }}
                placement='bottom'
            >
                <button
                    className={classNames('BandPresetButton', {'active': activeImageData?.displayPreset === entry.preset})}
                    onClick={() => setDisplayBands(entry.bands, entry.preset)}
                    type='button'
                    disabled={!activeBandCount}
                >
                    {entry.label}
                </button>
            </StyledTooltip>)}
        </div>;
    };

    return (
        <div className={getClassName()}>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'zoom-in',
                        'zoom in',
                        'ico/zoom-in.png',
                        'zoom-in',
                        false,
                        undefined,
                        () => ViewPortActions.zoomIn()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-out',
                        'zoom out',
                        'ico/zoom-out.png',
                        'zoom-out',
                        false,
                        undefined,
                        () => ViewPortActions.zoomOut()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-fit',
                        'fit image to available space',
                        'ico/zoom-fit.png',
                        'zoom-fit',
                        false,
                        undefined,
                        () => ViewPortActions.setDefaultZoom()
                    )
                }
                {
                    getButtonWithTooltip(
                        'zoom-max',
                        'maximum allowed image zoom',
                        'ico/zoom-max.png',
                        'zoom-max',
                        false,
                        undefined,
                        () => ViewPortActions.setOneForOneZoom()
                    )
                }
            </div>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'image-drag-mode',
                        imageDragMode ? 'turn-off image drag mode' : 'turn-on image drag mode - works only when image is zoomed',
                        'ico/hand.png',
                        'image-drag-mode',
                        imageDragMode,
                        undefined,
                        imageDragOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'cursor-cross-hair',
                        crossHairVisible ? 'turn-off cursor cross-hair' : 'turn-on cursor cross-hair',
                        'ico/cross-hair.png',
                        'cross-hair',
                        crossHairVisible,
                        undefined,
                        crossHairOnClick
                    )
                }
            </div>
            <div className='ButtonWrapper'>
                {
                    getButtonWithTooltip(
                        'dual-view-mode',
                        hasPairedImage
                            ? (dualViewEnabled ? 'turn-off dual linked view' : 'turn-on dual linked view')
                            : 'no paired image available for current file name',
                        'ico/camera.png',
                        'dual-view-mode',
                        dualViewEnabled,
                        undefined,
                        dualViewOnClick
                    )
                }
                {
                    getButtonWithTooltip(
                        'dual-sync-mode',
                        dualViewSyncEnabled
                            ? 'turn-off annotation sync between paired views'
                            : 'turn-on real-time annotation sync between paired views',
                        'ico/api.png',
                        'dual-sync-mode',
                        dualViewSyncEnabled,
                        undefined,
                        dualViewSyncOnClick
                    )
                }
            </div>
            {hasPairedImage && <div className='DualViewFocusInfo'>
                <div className='DualViewFocusBadge'>
                    {dualViewEnabled ? 'Dual View: ON' : 'Dual View: OFF'}
                </div>
                <div className='DualViewFocusText'>
                    Linked image: {pairedImageName}
                </div>
                <div className='DualViewFocusText'>
                    Sync: {dualViewSyncEnabled ? 'ON' : 'OFF'}
                </div>
                <div className='DualViewFocusText'>
                    Direction: {dualViewSyncDirection === DualViewSyncDirection.BIDIRECTIONAL ? 'Bidirectional' : 'Active->Linked'}
                </div>
                <div className='DualViewFocusText'>
                    Conflict: {dualViewSyncConflictPolicy === DualViewSyncConflictPolicy.LAST_WRITE_WINS ? 'Last write wins' : dualViewSyncConflictPolicy}
                </div>
                <button className='DualViewSmallButton' type='button' onClick={toggleSyncDirection}>
                    Toggle direction
                </button>
                <button className='DualViewSmallButton' type='button' onClick={toggleConflictPolicy}>
                    Conflict policy
                </button>
            </div>}
            {withAI && <div className='ButtonWrapper'>
                    {
                        getButtonWithTooltip(
                            'accept-all',
                            'accept all proposed detections',
                            'ico/accept-all.png',
                            'accept-all',
                            false,
                            undefined,
                            () => AIActions.acceptAllSuggestedLabels(LabelsSelector.getActiveImageData())
                        )
                    }
                    {
                        getButtonWithTooltip(
                            'reject-all',
                            'reject all proposed detections',
                            'ico/reject-all.png',
                            'reject-all',
                            false,
                            undefined,
                            () => AIActions.rejectAllSuggestedLabels(LabelsSelector.getActiveImageData())
                        )
                    }
                </div>}
            {renderTiffBandControls()}
        </div>
    );
};

const mapDispatchToProps = {
    updateImageDragModeStatusAction: updateImageDragModeStatus,
    updateCrossHairVisibleStatusAction: updateCrossHairVisibleStatus,
    updateImageDataByIdAction: updateImageDataById,
    updateDualViewEnabledAction: updateDualViewEnabled,
    updateDualViewSyncEnabledAction: updateDualViewSyncEnabled,
    updateDualViewSyncDirectionAction: updateDualViewSyncDirection,
    updateDualViewSyncConflictPolicyAction: updateDualViewSyncConflictPolicy
};

const mapStateToProps = (state: AppState) => ({
    activeContext: state.general.activeContext,
    imageDragMode: state.general.imageDragMode,
    crossHairVisible: state.general.crossHairVisible,
    dualViewEnabled: state.labels.dualViewEnabled,
    dualViewSyncEnabled: state.labels.dualViewSyncEnabled,
    dualViewSyncDirection: state.labels.dualViewSyncDirection,
    dualViewSyncConflictPolicy: state.labels.dualViewSyncConflictPolicy,
    hasPairedImage: (() => {
        const activeImage = state.labels.activeImageIndex === null ? null : state.labels.imagesData[state.labels.activeImageIndex];
        return !!(activeImage && state.labels.imagePairById[activeImage.id]);
    })(),
    pairedImageName: (() => {
        const activeImage = state.labels.activeImageIndex === null ? null : state.labels.imagesData[state.labels.activeImageIndex];
        if (!activeImage) {
            return null;
        }
        const pairedId = state.labels.imagePairById[activeImage.id];
        if (!pairedId) {
            return null;
        }
        const pairedImage = state.labels.imagesData.find((imageData) => imageData.id === pairedId);
        return pairedImage ? pairedImage.fileData.name : null;
    })(),
    activeLabelType: state.labels.activeLabelType,
    activeImageData: state.labels.activeImageIndex === null ? null : state.labels.imagesData[state.labels.activeImageIndex]
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorTopNavigationBar);
