# Requirements Draft

This document captures the initial product requirements provided by the team.
It is intended as a planning input before technical implementation work starts.

## 1) TIF Support (RGBI / 4-band imagery)

- Add support for opening and loading `.tif` / `.tiff` files in the labeling tool.
- Primary target use case is aerial imagery with 4 channels (RGBI).
- The tool should allow users to work with these images exactly as with `.jpg` and `.png` in standard labeling workflows.
- Display controls should support selecting visible bands, including:
  - single-band display (1 band)
  - 2-band combinations
  - 3-band combinations
  - 4-band display
  - any valid band combination supported by the source image

### 1.1 Current implementation baseline (from `src/`)

- Image ingestion currently accepts only `.jpeg` and `.png` in:
  - `src/views/MainView/ImagesDropZone/ImagesDropZone.tsx`
  - `src/views/PopupView/LoadMoreImagesPopup/LoadMoreImagesPopup.tsx`
- File type enum also assumes only jpeg/png:
  - `src/data/enums/AcceptedFileType.ts`
- Image decode path uses browser native `HTMLImageElement` only:
  - `src/utils/FileUtil.ts` (`loadImage`, `loadImages`)
  - `src/views/EditorView/Editor/Editor.tsx` (`FileUtil.loadImage(...)`)
  - `src/logic/imageRepository/ImageRepository.ts` (stores `HTMLImageElement`)
- This means current code cannot decode multi-band GeoTIFF/TIFF data or expose per-band display selection.

### 1.2 Technical changes required for Task 1

#### A) Add TIFF decoding capability

- Add a TIFF decoder dependency (recommended: browser-friendly TIFF reader such as `geotiff`).
- Implement a TIFF loading path that:
  - reads the TIFF file into array buffer
  - decodes raster bands
  - builds an RGBA renderable image (canvas/ImageBitmap/data URL) for editor rendering
  - provides metadata: width, height, band count, optional band names if available
- Keep jpeg/png decode path unchanged to avoid regressions.

#### B) Introduce normalized image source model (required for multi-band)

- Current `ImageData.fileData: File` is insufficient for dynamic band rendering.
- Extend `ImageData` in `src/store/labels/types.ts` with image source metadata for non-jpeg/png support, for example:
  - `sourceType` (`standard` or `tiff`)
  - `rasterMeta` (`width`, `height`, `bandCount`, `dtype`)
  - `displayBands` (active band indices used for current render)
  - `hasBandControls` / capability flag
- Preserve backward compatibility so existing annotation/import/export logic still works with old fields.

#### C) Update file acceptance and ingestion points

- Expand accepted extensions in:
  - `ImagesDropZone.tsx`
  - `LoadMoreImagesPopup.tsx`
  - include `.tif` and `.tiff`
- Update `AcceptedFileType.IMAGE` in `src/data/enums/AcceptedFileType.ts` to include TIFF MIME types/extensions.
- Ensure `ImageDataUtil.createImageDataFromFileData(...)` initializes new TIFF-related metadata fields.

#### D) Refactor `FileUtil` to support both standard and TIFF sources

- Keep existing `loadImage(file)` for jpeg/png.
- Add new TIFF-specific loader methods in `src/utils/FileUtil.ts`, for example:
  - load TIFF raster and metadata
  - compose selected bands into renderable RGB/RGBA output
  - regenerate display image when band selection changes
- Add unified helper so editor can request "renderable image for ImageData" regardless of source type.

#### E) Editor rendering integration

- In `src/views/EditorView/Editor/Editor.tsx`:
  - replace direct call pattern `FileUtil.loadImage(imageData.fileData)` with source-aware loading.
  - on TIFF, render from composed output generated from selected bands.
  - when user changes band selection, regenerate display image and re-render canvas while keeping annotations unchanged.
- In `ImageRepository`, store renderable image per `imageId` as today, but support refresh when display bands change.

#### F) Add band selection UI and state flow

- Add UI controls in editor (likely in right-side tools panel) for selecting display bands.
- Behavior requirements:
  - available only for TIFF images with `bandCount > 1`
  - support single, pair, triple, and quadruple band combinations
  - for 1/2 band modes, define deterministic visualization mapping (for example grayscale or duplicated channels)
  - update active image display immediately on selection change
- Persist selected display bands per image in Redux so switching between images preserves each image's view settings.

#### G) Annotation behavior guarantees

- Annotation geometry remains in pixel coordinates of rendered image dimensions.
- Band switching must not alter annotation coordinates, scale, or ordering.
- All existing annotation tools (rect/point/line/polygon), editing, and selection behavior must work identically on TIFF display.

#### H) AI feature interaction (explicit handling)

- Local AI models (`SSD`, `YOLO`, `PoseNet`) currently use `HTMLImageElement` from repository.
- For TIFF images:
  - initial implementation option 1: run AI on current composed display image
  - initial implementation option 2: disable AI with non-blocking warning until validated
- Roboflow API path (`src/ai/RoboflowAPIObjectDetector.ts`) uses `FileUtil.loadImageBase64(imageData.fileData)`; this may fail for TIFF expectations.
- Define explicit behavior in code:
  - either convert composed TIFF display to supported base64 image for upload
  - or disable Roboflow for TIFF and show user-facing info notification

#### I) Performance and memory handling

- TIFF files can be large; avoid full repeated decode for every render frame.
- Cache decoded raster data per image, and only recompute display texture when band selection changes.
- Release object URLs / temporary bitmaps where applicable to prevent memory leaks.

### 1.3 Concrete file-level change list for Task 1

- `src/data/enums/AcceptedFileType.ts`
  - extend image accepted MIME/extensions to include TIFF.
- `src/views/MainView/ImagesDropZone/ImagesDropZone.tsx`
  - accept `.tif/.tiff`.
- `src/views/PopupView/LoadMoreImagesPopup/LoadMoreImagesPopup.tsx`
  - accept `.tif/.tiff`.
- `src/store/labels/types.ts`
  - extend `ImageData` with TIFF and band-display metadata.
- `src/utils/ImageDataUtil.ts`
  - initialize new metadata defaults and preserve compatibility.
- `src/utils/FileUtil.ts`
  - add TIFF decoding/composition API alongside existing loaders.
- `src/views/EditorView/Editor/Editor.tsx`
  - use source-aware load path and support display recompose on band updates.
- `src/logic/imageRepository/ImageRepository.ts`
  - support updating cached renderable image when selected bands change.
- `src/views/EditorView/*` (exact component to be chosen during implementation)
  - add band selection UI controls and dispatch actions.
- `src/store/labels/actionCreators.ts`, `src/store/labels/reducer.ts`
  - add actions/state updates for per-image band selection.
- `src/logic/actions/AIActions.ts` and `src/ai/RoboflowAPIObjectDetector.ts`
  - implement explicit TIFF behavior (supported conversion or graceful disable).

### 1.4 Testing scope for Task 1

- Unit tests:
  - TIFF metadata parsing and band count detection.
  - band selection -> composed image generation.
  - Redux state updates for per-image band settings.
- Integration tests:
  - load TIFF from dropzone/load-more flows.
  - draw/edit annotations on TIFF and ensure persistence across image switches.
  - switch bands and verify annotations remain aligned.
- Regression tests:
  - existing `.jpg/.png` load and annotation behavior unchanged.
  - COCO/YOLO/VOC import-export still functions on standard images.

### 1.5 Acceptance criteria for Task 1

- User can load `.tif/.tiff` from both initial dropzone and load-more popup.
- TIFF images appear in image list and can be annotated with existing tools.
- User can choose valid band combinations (1/2/3/4 bands and other valid combos) for TIFF display.
- Changing display bands updates image visualization without modifying annotation data.
- Existing `.jpg/.png` workflows remain unaffected.
- Unsupported AI-on-TIFF paths are either functional through conversion or explicitly disabled with a clear, non-blocking message.

## 2) Folder-Based COCO Dataset Loading

- Add support for loading datasets from a COCO-like folder structure.
- Expected structure:
  - image files are in `train/` or `valid/` directories
  - annotations are in an `annotations/` directory
- The user should provide:
  - path to the image directory (for example `train/` or `valid/`)
  - path to the COCO annotation JSON file
- Keep the loading flow simple: no hard-coded dataset rules beyond user-provided paths.
- If some images or references are missing during load, skip them and show a light warning.

### 2.1 Current implementation baseline (from `src/`)

- Current workflow is two-step and manual:
  - user first loads images (`MainView` dropzone / load-more popup)
  - user then imports annotations in `ImportLabelPopup`
- COCO import (`src/logic/import/coco/COCOImporter.ts`) matches annotations to existing loaded images by exact filename:
  - `COCOImage.file_name` must equal `imageData.fileData.name`
- COCO importer currently accepts only annotation file(s), not dataset folder context.
- No current concept of a "dataset loader" that takes both image directory and annotation JSON in one flow.
- Missing/mismatched files are effectively skipped in importer logic, but there is no explicit user-facing "skipped items" summary.

### 2.2 Technical changes required for Task 2

#### A) Add a single dataset-load flow (images dir + annotation file)

- Introduce a new UI flow where user provides:
  - image directory (containing images)
  - COCO annotation JSON file
- Keep flow generic and path-driven (no hard-coded `train` / `valid` assumptions in code behavior).
- The UI should support selecting any folder and any COCO JSON, as long as filenames can be matched.

#### B) Add a dedicated dataset loading popup/component

- Add a new popup action entry (for example, "Load dataset (COCO)").
- Component responsibilities:
  - collect image directory files
  - collect annotation JSON file
  - validate minimal inputs before enabling "Load"
  - show lightweight warnings for skipped items after processing
- This should be independent from current annotation-only import popup to avoid breaking existing workflows.

#### C) Implement a folder-aware COCO loader service

- Create a new logic module (for example under `src/logic/import/coco/`) to orchestrate:
  - building `ImageData[]` from selected image directory files
  - parsing COCO JSON
  - applying annotations to matching images
  - returning result + warnings (counts and filenames)
- Reuse existing `COCOImporter` internals where possible, but adapt to "combined load" scenario.
- Keep filename-based matching as primary strategy (simple and deterministic).

#### D) Missing file handling (explicit warning behavior)

- If COCO references image filenames not found in selected image directory:
  - skip those annotations/images
  - continue import (non-fatal)
  - show light warning notification with summary:
    - number of missing images
    - optional list preview (truncated) of missing filenames
- If selected image directory contains files absent from COCO:
  - include those images in project with empty annotations (recommended behavior)
  - optionally warn with count only, not blocking

#### E) File-type and extension filtering for dataset load

- Image folder selection should accept supported image extensions (including TIFF from Task 1 when available).
- Annotation selection for this flow should be COCO JSON only.
- Ensure accidental non-image files in selected directory are ignored safely.

#### F) Redux/store update strategy for combined load

- On successful dataset load:
  - replace/initialize `imagesData` with loaded image list and applied annotations
  - update `labelNames` from COCO categories
  - set `activeImageIndex = 0` when at least one image is loaded
  - set/retain project type according to current app rules
- Ensure state updates are atomic from user perspective (single "Load" action).

#### G) Maintain existing import path compatibility

- Do not remove existing "import annotations" popup behavior.
- Existing users who load images manually then import COCO should continue to work exactly as before.
- New dataset flow is additive.

#### H) UX and notification requirements

- Success notification should include:
  - number of loaded images
  - number of applied annotations
  - number of skipped references
- Warning notifications should be "light" and non-blocking, per requirement.
- Hard failure should only occur on truly invalid JSON/COCO schema or unreadable files.

### 2.3 Concrete file-level change list for Task 2

- `src/data/enums/PopupWindowType.ts`
  - add popup type for folder-based COCO dataset load.
- `src/views/PopupView/PopupView.tsx`
  - route new popup type to new component.
- `src/views/PopupView/*` (new component, for example `LoadCocoDatasetPopup`)
  - implement combined folder + COCO file selection flow.
- `src/logic/import/coco/*`
  - add dataset orchestration class/service that combines image ingestion + COCO apply.
- `src/logic/import/coco/COCOImporter.ts`
  - optionally refactor for reuse (avoid duplicate parsing/mapping logic).
- `src/utils/ImageDataUtil.ts`
  - helper usage for creating `ImageData` from selected directory files.
- `src/store/labels/actionCreators.ts`, `src/store/labels/reducer.ts`
  - ensure efficient state replacement/update for combined load.
- `src/store/notifications/*` and `src/data/info/NotificationsData.ts`
  - add lightweight warning/success notifications for skipped/missing files.
- `src/views/MainView/*` and/or `src/views/EditorView/*`
  - add UI trigger to open the new dataset loader popup.

### 2.4 Matching and data rules for Task 2

- Matching key: filename equality between COCO `images[*].file_name` and selected folder file names.
- Directory paths from COCO should not be required for MVP; only filename matching.
- Case-sensitivity behavior should be defined consistently (recommended: case-insensitive on Windows-like environments, normalized compare).
- Duplicate filenames in selected folder should be handled deterministically:
  - either first match wins with warning
  - or fail fast with clear duplicate-name message (choose during implementation).

### 2.5 Testing scope for Task 2

- Unit tests:
  - filename matching logic with normal/edge cases.
  - missing-reference summary generation.
  - COCO parse/validation failure paths.
- Integration tests:
  - load image folder + COCO JSON in one action.
  - verify labels/categories/images are all updated in store.
  - verify missing referenced images are skipped with warning.
  - verify extra images (not referenced in COCO) still load with no annotations.
- Regression tests:
  - existing annotation-only import popup remains functional.
  - existing jpg/png (and TIFF if implemented) image ingestion flows remain functional.

### 2.6 Acceptance criteria for Task 2

- User can provide an image directory and a COCO annotation JSON in a single dataset-load flow.
- System loads images and applies matching annotations in one operation.
- Missing COCO-referenced images are skipped without blocking import.
- User receives light warning summary for skipped/missing items.
- Existing manual workflow (load images first, then import annotations) still works unchanged.

## 3) Geospatial Handling Scope

- Source imagery may have geospatial metadata.
- For this project, annotation save/load does **not** need GeoTIFF-specific geospatial output.
- Annotations should be handled in normal supported annotation formats.
- Georeferencing of predicted or labeled bounding boxes will be handled in a separate post-processing pipeline.

### 3.1 Current implementation baseline (from `src/`)

- Current annotation pipeline is image-pixel based and format-driven (COCO/YOLO/VOC/CSV/etc.), not geospatial-coordinate driven.
- Annotation data model in `src/store/labels/types.ts` stores shapes in pixel coordinates only:
  - rects, points, lines, polygons relative to image dimensions
- Importers/exporters under `src/logic/import/*` and `src/logic/export/*` currently operate on non-geospatial schema contracts.
- No existing storage path for CRS, affine transform, geotransform, EPSG code, or world-coordinate bboxes.

### 3.2 Technical changes required for Task 3

#### A) Define explicit non-goals in code and docs

- Confirm and enforce that geospatial metadata is out of scope for annotation output in this phase.
- Ensure new TIFF support work (Task 1) does not accidentally imply geospatial export support.
- Keep all exports in current standard formats and coordinate spaces.

#### B) Preserve pixel-space annotation semantics across all workflows

- All creation/edit operations must continue using image pixel coordinates.
- Loading TIFF images (including multi-band display) must not alter coordinate reference used by labels.
- Import/export must remain consistent with current pixel-based assumptions.

#### C) Keep importer/exporter contracts unchanged for geospatial fields

- Do not add geospatial fields to exported COCO/YOLO/VOC payloads in this phase.
- Do not require geospatial keys in imported annotation files.
- If incoming files include extra geospatial fields (custom extensions), ignore them safely unless needed later.

#### D) Optional metadata capture boundary (non-blocking, internal only)

- If useful for future work, allow storing lightweight image geospatial metadata in memory (or optional state fields) without:
  - exposing it in current export outputs
  - requiring it in annotation editing logic
  - coupling editor tools to GIS transforms
- This is optional and should not block delivery of Tasks 1 and 2.

#### E) User communication behavior

- Add concise UX messaging where relevant (for example in TIFF loader or docs):
  - geospatial metadata may be present in imagery
  - current annotation exports are non-georeferenced
  - georeferencing is expected to happen in downstream post-processing

### 3.3 Concrete file-level change list for Task 3

- `REQUIREMENTS.md` and/or user-facing help text docs
  - include explicit statement that geospatial export/import is out of scope.
- `src/logic/export/*` (all active exporters)
  - verify no geospatial fields are added by Task 1/2 refactors.
- `src/logic/import/*` (especially COCO/YOLO/VOC importers)
  - keep geospatial keys optional/ignored, with no hard dependency.
- `src/store/labels/types.ts` (optional)
  - if adding future-facing metadata placeholders, keep them non-required and non-functional for current exports.
- `src/views/PopupView/*` and notification texts (optional)
  - add informational notice that outputs are standard non-geospatial annotations.

### 3.4 Guardrails and regression requirements

- Task 1 (TIFF support) must not introduce world-coordinate transforms into annotation math.
- Task 2 (folder COCO load) must continue matching and applying annotations in image pixel space.
- Export files generated after these changes must remain schema-compatible with existing downstream tooling.
- Any optional geospatial metadata parsing must be isolated from core annotation behavior.

### 3.5 Testing scope for Task 3

- Unit tests:
  - verify annotation coordinates remain pixel-based after TIFF load and band changes.
  - verify importers/exporters ignore unknown geospatial-like extra fields without crashing.
- Integration tests:
  - annotate TIFF image, export annotations, and confirm output remains standard format (no geospatial fields injected).
  - load dataset + annotations, edit, export, and confirm unchanged schema shape.
- Regression tests:
  - existing non-TIFF projects export exactly as before.
  - current import format validation behavior remains unchanged.

### 3.6 Acceptance criteria for Task 3

- The system supports imagery that may contain geospatial metadata without requiring geospatial processing in labeling flows.
- All annotation editing remains pixel-coordinate based.
- Export/import outputs remain standard, non-georeferenced annotation formats.
- Any geospatial conversion responsibility remains external to this package and is clearly documented for users.

## 4) Dual-View Support (Future Exploration)

- Add support for dual view with two images of the same location.
- The paired images share the same filename but live in different directories/locations.
- By default, each view should maintain separate annotations.
- Add a configurable option to enable real-time annotation sharing/synchronization between views.
- Detailed interaction and UX behavior will be further specified in a follow-up design step.

### 4.1 Current implementation baseline (from `src/`)

- Current editor architecture is single-view and single-active-image:
  - one main canvas in `src/views/EditorView/Editor/Editor.tsx`
  - one `activeImageIndex` in labels store (`src/store/labels/types.ts`)
- Rendering and interactions are managed by global editor models/actions:
  - `EditorModel`, `EditorActions`, `ViewPortActions`
  - assumptions are currently "one active viewport/canvas context at a time"
- Annotation collections are stored per image (`ImageData`), which is a good base for separate annotations per view pair.
- No existing pairing concept that links two image records representing same location.

### 4.2 Technical changes required for Task 4

#### A) Introduce image-pair domain model

- Add a pairing model to relate two images with same logical scene across different directories/sources.
- Pairing should be deterministic and driven by filename base matching (as specified by requirement).
- Store pair association separately from annotation content so default behavior remains independent annotations.

#### B) Add dual-view layout mode in editor

- Add a configurable editor mode with two synchronized canvases/panels:
  - left view: image A
  - right view: image B
- Each panel must support independent:
  - rendering
  - active label selection
  - annotation creation/editing
  - zoom/pan state (unless synchronized viewport mode is later enabled)
- Keep existing single-view mode available to avoid regressions.

#### C) Separate annotations by default

- Default behavior: each paired image keeps its own annotation arrays (`labelRects`, `labelPoints`, etc.) with no implicit cross-copy.
- Editing in one panel should not alter the other panel unless sync mode is explicitly enabled.
- Save/export paths should operate on each image's own annotations as normal.

#### D) Configurable real-time annotation sharing mode

- Add a user-facing toggle to enable/disable annotation synchronization across paired images.
- In sync-enabled mode:
  - create/edit/delete operations in source view are mirrored to paired target view in near real-time
  - mapping strategy should be explicit (id remap, geometry mapping rules, label mapping rules)
- In sync-disabled mode:
  - no propagation between views
- Toggle state should be visible and persisted in app state for predictable behavior.

#### E) Define synchronization semantics (must be explicit)

- Minimum operation coverage when sync is ON:
  - create annotation
  - update geometry
  - update assigned label name
  - delete annotation
- Define identity strategy:
  - source annotation id and mirrored annotation id mapping table (recommended), or deterministic id derivation
- Define conflict behavior:
  - if user edits both sides rapidly, "last write wins" or source-of-truth policy must be specified
- Define type scope:
  - sync should be consistent for rect/point/line/polygon or intentionally limited with clear UX notice.

#### F) Pair discovery and management

- Add pairing resolution logic during dataset load / image ingestion:
  - detect candidates by shared file name across two configured locations
  - build pair map and mark unpaired images
- Unpaired images should still be editable in single-view and dual-view should degrade gracefully (for example one side empty/disabled).
- Provide lightweight feedback on number of paired vs unpaired images.

#### G) Navigation and selection behavior

- Add dual navigation controls:
  - moving to next/previous pair
  - ability to focus left or right view for active tool operations
- Keyboard shortcuts and existing label tools should continue to function with clear active-panel focus.
- Ensure popup operations/import/export continue to behave predictably in dual mode.

#### H) Performance and architecture constraints

- Two canvases imply more rendering work; avoid full rerenders when only one panel changes.
- Refactor global singleton assumptions where needed:
  - avoid shared mutable editor state collisions between two simultaneous canvases
  - isolate per-panel viewport/editor state objects
- Maintain acceptable interaction latency for common annotation operations.

### 4.3 Concrete file-level change list for Task 4

- `src/store/labels/types.ts`
  - add pairing metadata types and dual-view mode/sync flags.
- `src/store/labels/reducer.ts`, `src/store/labels/actionCreators.ts`
  - add actions/state transitions for:
    - set dual-view enabled/disabled
    - set sync enabled/disabled
    - set active pair / active panel focus
    - maintain mirrored-id mapping when sync is enabled
- `src/views/EditorView/EditorContainer/EditorContainer.tsx`
  - render single or dual editor layout.
- `src/views/EditorView/Editor/Editor.tsx`
  - support panel-scoped editor instance behavior (not global-only assumptions).
- `src/logic/actions/EditorActions.ts`, `src/logic/actions/ViewPortActions.ts`
  - split global editor/viewport operations into panel-aware operations.
- `src/staticModels/EditorModel.ts`
  - refactor singleton state into per-panel model or keyed model registry.
- `src/logic/actions/LabelActions.ts` (and related shape actions)
  - inject synchronization hook for create/update/delete when sync mode is ON.
- `src/views/EditorView/*` (toolbar/options)
  - add UI controls for dual-view toggle and real-time sync toggle.
- `src/logic/import/*` and dataset load flow (Task 2 integration)
  - add pair-detection construction during load.

### 4.4 Sync safety and data integrity rules

- Sync must never overwrite target annotations when mode is OFF.
- Toggling sync ON should define whether existing annotations are:
  - left untouched (recommended MVP), or
  - optionally backfilled with explicit user action.
- Toggling sync OFF should stop propagation immediately without data loss.
- Mirrored operations should preserve label consistency:
  - if label name does not exist on target, auto-create or skip with warning (decision required during implementation).

### 4.5 Testing scope for Task 4

- Unit tests:
  - pair mapping logic (filename-based matching).
  - sync reducer/action behavior for create/update/delete propagation.
  - sync toggle transitions and id-mapping integrity.
- Integration tests:
  - dual-view render with paired images.
  - default separate annotation behavior (no sync).
  - real-time sync behavior when enabled.
  - disable sync and verify propagation stops.
  - navigation across pairs including unpaired-edge cases.
- Regression tests:
  - existing single-view editor behavior unchanged when dual-view is off.
  - import/export flows continue to function for per-image annotations.

### 4.6 Acceptance criteria for Task 4

- User can enable dual-view and see two paired images simultaneously.
- By default, annotations remain independent between the two views.
- User can enable a configurable real-time sync mode that mirrors annotation operations across views.
- User can disable sync at any time and editing returns to independent behavior immediately.
- Existing single-view workflows remain stable and unaffected when dual-view is not enabled.

## Notes

- This is a requirements capture draft, not an implementation spec.
- Technical design decisions, architecture changes, and task breakdown are deferred to a later planning phase.
