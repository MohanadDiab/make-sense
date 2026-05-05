import { PrimaryEditorRenderEngine } from "../logic/render/PrimaryEditorRenderEngine";
import { BaseRenderEngine } from "../logic/render/BaseRenderEngine";
import { IRect } from "../interfaces/IRect";
import { IPoint } from "../interfaces/IPoint";
import { ISize } from "../interfaces/ISize";
import Scrollbars from "react-custom-scrollbars-2";
import { ViewPortHelper } from "../logic/helpers/ViewPortHelper";

type EditorState = {
    editor: HTMLDivElement;
    canvas: HTMLCanvasElement;
    mousePositionIndicator: HTMLDivElement;
    cursor: HTMLDivElement;
    viewPortScrollbars: Scrollbars;
    image: HTMLImageElement;
    primaryRenderingEngine: PrimaryEditorRenderEngine;
    supportRenderingEngine: BaseRenderEngine;
    viewPortHelper: ViewPortHelper;
    isLoading: boolean;
    viewPortActionsDisabled: boolean;
    mousePositionOnViewPortContent: IPoint;
    viewPortSize: ISize;
    defaultRenderImageRect: IRect;
}

export class EditorModel {
    private static activeEditorKey: string = 'primary';
    private static registry: {[key: string]: Partial<EditorState>} = {};

    public static activate(editorKey: string): void {
        EditorModel.activeEditorKey = editorKey || 'primary';
        EditorModel.ensure(EditorModel.activeEditorKey);
    }

    private static ensure(editorKey: string): void {
        if (!EditorModel.registry[editorKey]) {
            EditorModel.registry[editorKey] = {
                isLoading: false,
                viewPortActionsDisabled: false
            };
        }
    }

    private static get state(): Partial<EditorState> {
        EditorModel.ensure(EditorModel.activeEditorKey);
        return EditorModel.registry[EditorModel.activeEditorKey];
    }

    public static set editor(value: HTMLDivElement) { EditorModel.state.editor = value; }
    public static get editor(): HTMLDivElement { return EditorModel.state.editor; }

    public static set canvas(value: HTMLCanvasElement) { EditorModel.state.canvas = value; }
    public static get canvas(): HTMLCanvasElement { return EditorModel.state.canvas; }

    public static set mousePositionIndicator(value: HTMLDivElement) { EditorModel.state.mousePositionIndicator = value; }
    public static get mousePositionIndicator(): HTMLDivElement { return EditorModel.state.mousePositionIndicator; }

    public static set cursor(value: HTMLDivElement) { EditorModel.state.cursor = value; }
    public static get cursor(): HTMLDivElement { return EditorModel.state.cursor; }

    public static set viewPortScrollbars(value: Scrollbars) { EditorModel.state.viewPortScrollbars = value; }
    public static get viewPortScrollbars(): Scrollbars { return EditorModel.state.viewPortScrollbars; }

    public static set image(value: HTMLImageElement) { EditorModel.state.image = value; }
    public static get image(): HTMLImageElement { return EditorModel.state.image; }

    public static set primaryRenderingEngine(value: PrimaryEditorRenderEngine) { EditorModel.state.primaryRenderingEngine = value; }
    public static get primaryRenderingEngine(): PrimaryEditorRenderEngine { return EditorModel.state.primaryRenderingEngine; }

    public static set supportRenderingEngine(value: BaseRenderEngine) { EditorModel.state.supportRenderingEngine = value; }
    public static get supportRenderingEngine(): BaseRenderEngine { return EditorModel.state.supportRenderingEngine; }

    public static set viewPortHelper(value: ViewPortHelper) { EditorModel.state.viewPortHelper = value; }
    public static get viewPortHelper(): ViewPortHelper { return EditorModel.state.viewPortHelper; }

    public static set isLoading(value: boolean) { EditorModel.state.isLoading = value; }
    public static get isLoading(): boolean { return EditorModel.state.isLoading || false; }

    public static set viewPortActionsDisabled(value: boolean) { EditorModel.state.viewPortActionsDisabled = value; }
    public static get viewPortActionsDisabled(): boolean { return EditorModel.state.viewPortActionsDisabled || false; }

    public static set mousePositionOnViewPortContent(value: IPoint) { EditorModel.state.mousePositionOnViewPortContent = value; }
    public static get mousePositionOnViewPortContent(): IPoint { return EditorModel.state.mousePositionOnViewPortContent; }

    public static set viewPortSize(value: ISize) { EditorModel.state.viewPortSize = value; }
    public static get viewPortSize(): ISize { return EditorModel.state.viewPortSize; }

    public static set defaultRenderImageRect(value: IRect) { EditorModel.state.defaultRenderImageRect = value; }
    public static get defaultRenderImageRect(): IRect { return EditorModel.state.defaultRenderImageRect; }
}