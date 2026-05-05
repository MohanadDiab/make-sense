import React, {useEffect, useState} from 'react';
import {connect} from 'react-redux';
import {Direction} from '../../../data/enums/Direction';
import {ISize} from '../../../interfaces/ISize';
import {Settings} from '../../../settings/Settings';
import {AppState} from '../../../store';
import {ImageData} from '../../../store/labels/types';
import ImagesList from '../SideNavigationBar/ImagesList/ImagesList';
import LabelsToolkit from '../SideNavigationBar/LabelsToolkit/LabelsToolkit';
import {SideNavigationBar} from '../SideNavigationBar/SideNavigationBar';
import {VerticalEditorButton} from '../VerticalEditorButton/VerticalEditorButton';
import './EditorContainer.scss';
import Editor from '../Editor/Editor';
import {ContextManager} from '../../../logic/context/ContextManager';
import {ContextType} from '../../../data/enums/ContextType';
import EditorBottomNavigationBar from '../EditorBottomNavigationBar/EditorBottomNavigationBar';
import EditorTopNavigationBar from '../EditorTopNavigationBar/EditorTopNavigationBar';
import {ProjectType} from '../../../data/enums/ProjectType';
import {updateActiveImageIndex} from '../../../store/labels/actionCreators';
import {CocoManualAutosave} from '../../../logic/autosave/CocoManualAutosave';

interface IProps {
    windowSize: ISize;
    activeImageIndex: number;
    imagesData: ImageData[];
    imagePairById: {[imageId: string]: string};
    dualViewEnabled: boolean;
    updateActiveImageIndexAction: (activeImageIndex: number) => any;
    activeContext: ContextType;
    projectType: ProjectType;
}

const EditorContainer: React.FC<IProps> = (
    {
        windowSize,
        activeImageIndex,
        imagesData,
        imagePairById,
        dualViewEnabled,
        updateActiveImageIndexAction,
        activeContext,
        projectType
    }) => {
    const [leftTabStatus, setLeftTabStatus] = useState(true);
    const [rightTabStatus, setRightTabStatus] = useState(true);

    useEffect(() => {
        // Save immediately when user navigates between images.
        CocoManualAutosave.flush('image_change').catch(() => null);
    }, [activeImageIndex]);

    const calculateEditorSize = (): ISize => {
        if (windowSize) {
            const leftTabWidth = leftTabStatus ? Settings.SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX : Settings.SIDE_NAVIGATION_BAR_WIDTH_CLOSED_PX;
            const rightTabWidth = rightTabStatus ? Settings.SIDE_NAVIGATION_BAR_WIDTH_OPEN_PX : Settings.SIDE_NAVIGATION_BAR_WIDTH_CLOSED_PX;
            return {
                width: windowSize.width - leftTabWidth - rightTabWidth,
                height: windowSize.height - Settings.TOP_NAVIGATION_BAR_HEIGHT_PX
                    - Settings.EDITOR_BOTTOM_NAVIGATION_BAR_HEIGHT_PX - Settings.EDITOR_TOP_NAVIGATION_BAR_HEIGHT_PX,
            }
        }
        else
            return null;
    };

    const leftSideBarButtonOnClick = () => {
        if (!leftTabStatus)
            ContextManager.switchCtx(ContextType.LEFT_NAVBAR);
        else if (leftTabStatus && activeContext === ContextType.LEFT_NAVBAR)
            ContextManager.restoreCtx();

        setLeftTabStatus(!leftTabStatus);
    };

    const leftSideBarCompanionRender = () => {
        return <>
            <VerticalEditorButton
                label='Images'
                image={'/ico/camera.png'}
                imageAlt={'images'}
                onClick={leftSideBarButtonOnClick}
                isActive={leftTabStatus}
            />
        </>
    };

    const leftSideBarRender = () => {
        return <ImagesList/>
    };

    const rightSideBarButtonOnClick = () => {
        if (!rightTabStatus)
            ContextManager.switchCtx(ContextType.RIGHT_NAVBAR);
        else if (rightTabStatus && activeContext === ContextType.RIGHT_NAVBAR)
            ContextManager.restoreCtx();

        setRightTabStatus(!rightTabStatus);
    };

    const rightSideBarCompanionRender = () => {
        return <>
            <VerticalEditorButton
                label='Labels'
                image={'/ico/tags.png'}
                imageAlt={'labels'}
                onClick={rightSideBarButtonOnClick}
                isActive={rightTabStatus}
            />
        </>
    };

    const rightSideBarRender = () => {
        return <LabelsToolkit/>
    };

    const activeImageData = imagesData[activeImageIndex];
    const pairedImageId = activeImageData ? imagePairById[activeImageData.id] : null;
    const pairedImageData = pairedImageId ? imagesData.find((imageData: ImageData) => imageData.id === pairedImageId) : null;
    const pairedImageIndex = pairedImageData ? imagesData.findIndex((imageData: ImageData) => imageData.id === pairedImageData.id) : -1;
    const isDualViewActive = dualViewEnabled && !!pairedImageData;

    return (
        <div className='EditorContainer'>
            <SideNavigationBar
                direction={Direction.LEFT}
                isOpen={leftTabStatus}
                isWithContext={activeContext === ContextType.LEFT_NAVBAR}
                renderCompanion={leftSideBarCompanionRender}
                renderContent={leftSideBarRender}
                key='left-side-navigation-bar'
            />
            <div className={isDualViewActive ? 'EditorWrapper dual' : 'EditorWrapper'}
                onMouseDown={() => ContextManager.switchCtx(ContextType.EDITOR)}
                 key='editor-wrapper'
            >
                {projectType === ProjectType.OBJECT_DETECTION && <EditorTopNavigationBar
                    key='editor-top-navigation-bar'
                />}
                {!isDualViewActive && <Editor
                    size={calculateEditorSize()}
                    imageData={imagesData[activeImageIndex]}
                    editorKey='primary'
                    key='editor'
                />}
                {isDualViewActive && <div className='DualEditors'>
                    <div className='EditorPane' onMouseDown={() => updateActiveImageIndexAction(activeImageIndex)}>
                        <Editor
                            size={{width: Math.floor(calculateEditorSize().width / 2), height: calculateEditorSize().height}}
                            imageData={imagesData[activeImageIndex]}
                            editorKey='primary'
                            key='editor-primary'
                        />
                    </div>
                    <div className='EditorPane' onMouseDown={() => pairedImageIndex >= 0 && updateActiveImageIndexAction(pairedImageIndex)}>
                        <Editor
                            size={{width: Math.floor(calculateEditorSize().width / 2), height: calculateEditorSize().height}}
                            imageData={pairedImageData}
                            editorKey='linked'
                            key='editor-linked'
                        />
                    </div>
                </div>}
                <EditorBottomNavigationBar
                    imageData={imagesData[activeImageIndex]}
                    size={calculateEditorSize()}
                    totalImageCount={imagesData.length}
                    key='editor-bottom-navigation-bar'
                />
            </div>
            <SideNavigationBar
                direction={Direction.RIGHT}
                isOpen={rightTabStatus}
                isWithContext={activeContext === ContextType.RIGHT_NAVBAR}
                renderCompanion={rightSideBarCompanionRender}
                renderContent={rightSideBarRender}
                key='right-side-navigation-bar'
            />
        </div>
    );
};

const mapStateToProps = (state: AppState) => ({
    windowSize: state.general.windowSize,
    activeImageIndex: state.labels.activeImageIndex,
    imagesData: state.labels.imagesData,
    imagePairById: state.labels.imagePairById,
    dualViewEnabled: state.labels.dualViewEnabled,
    activeContext: state.general.activeContext,
    projectType: state.general.projectData.type
});

const mapDispatchToProps = {
    updateActiveImageIndexAction: updateActiveImageIndex
};

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(EditorContainer);