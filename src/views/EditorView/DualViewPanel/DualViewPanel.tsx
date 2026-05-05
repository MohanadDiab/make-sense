import React, {useEffect, useState} from 'react';
import {ImageData} from '../../../store/labels/types';
import {FileUtil} from '../../../utils/FileUtil';
import './DualViewPanel.scss';

interface IProps {
    imageData: ImageData;
    onFocusLinkedImage: () => void;
}

const DualViewPanel: React.FC<IProps> = ({imageData, onFocusLinkedImage}) => {
    const [previewSrc, setPreviewSrc] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        FileUtil.loadRenderableImage(imageData)
            .then((image: HTMLImageElement) => {
                if (!cancelled) {
                    setPreviewSrc(image.src);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setPreviewSrc(null);
                }
            });
        return () => {
            cancelled = true;
        };
    }, [imageData.id, imageData.displayBands?.join(',')]);

    return <div className='DualViewPanel'>
        <div className='DualViewPanelHeader'>
            Linked view: {imageData.fileData.name}
        </div>
        <div className='DualViewPanelImageWrapper'>
            {previewSrc
                ? <img src={previewSrc} alt={imageData.fileData.name} draggable={false}/>
                : <div className='DualViewPanelPlaceholder'>Unable to preview linked image.</div>}
        </div>
        <div className='DualViewPanelMeta'>
            Annotations remain independent unless sync mode is enabled.
        </div>
        <div className='DualViewPanelActions'>
            <button type='button' onClick={onFocusLinkedImage}>
                Edit linked image
            </button>
        </div>
    </div>;
};

export default DualViewPanel;
