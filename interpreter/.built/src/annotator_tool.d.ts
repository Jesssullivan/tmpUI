import "./leaflet_annotation.css";
declare const React: any;
declare const Draw: Promise<any>;
export { Draw };
export declare class LeafletAnnotation extends React.Component {
    constructor(props: any);
    componentDidMount: () => void;
    componentWillUnmount: () => void;
    componentDidUpdate: () => void;
    renderForSpectrogram: (targetHeight?: number) => void;
    fillMapPrev: () => void;
    turnOffDrag: () => void;
    turnOffZoom: () => void;
    panTo: (x: any) => void;
    enableEditing: () => void;
    disableEditing: () => void;
    enableHotKeys: () => void;
    disableHotKeys: () => void;
    handleKeyDown: (e: any) => void;
    getBoxPathStyle: (index: any) => any;
    createBoxLayer: () => void;
    addAnnotation: (annotation: any, annotationIndex: any) => {
        bbox: any;
        segmentation: any;
    };
    addLayer: (layer: any) => void;
    removeLayer: (layer: any) => void;
    restrictPointToImageBounds: (x: any, y: any) => any[];
    clipRectangleLayerToImageBounds: (layer: any) => any;
    showAnnotation: (annotation_layer: any) => void;
    handleClassifyWaveform: (waveform: Float32Array) => Promise<(Float32Array | string[])[]>;
    handleClassify: (annotationIndex: number) => void;
    hideAnnotation: (annotation_layer: any) => void;
    annotateBBox: ({ isNewInstance, annotationIndex }?: {
        isNewInstance?: boolean;
        annotationIndex?: any;
    }) => void;
    bboxCursorUpdate: (e: any) => void;
    cancelAnnotation: () => void;
    duplicateAnnotationAtIndex({ annotationIndex, objectCenter, isKey }?: {
        annotationIndex: any;
        objectCenter?: any;
        isKey?: boolean;
    }): any[];
    duplicateAnnotationDrawShortcut: (annotationIndex: any) => any[];
    setAnnotationsModified: (modified: any) => void;
    _layerMoved: (e: any) => void;
    _layerResized: (e: any) => void;
    _drawStartEvent: (e: any) => void;
    _drawStopEvent: () => void;
    _drawCreatedEvent: (e: any) => void;
    _handleLeafletDuplicate: (mouseEvent?: any) => void;
    handleCreateNewIndividual: () => void;
    handleHideAllAnnotations: () => void;
    handleShowAllAnnotations: () => void;
    handleAnnotationDelete: (annotationIndex: any) => void;
    handleAnnotationFocus: (annotationIndex: any) => void;
    handleHideOtherAnnotations: (annotationIndex: any) => void;
    handleAnnotationCategoryChange: (annotationIndex: any) => void;
    handleAnnotationSupercategoryChange: (annotationIndex: any) => void;
    handleAnnotationIsCrowdChange: (annotationIndex: any, isCrowd: any) => void;
    handleAnnotationDrawBox: (annotationIndex: any) => void;
    handleCategorySelected: (categoryIndex: any) => void;
    handleCategoryRemoved: () => void;
    handleCategorySelectionCancelled: () => void;
    extractBBox: (layer: any) => number[];
    getAnnotations: ({ modifiedOnly, excludeDeleted }?: {
        modifiedOnly?: boolean;
        excludeDeleted?: boolean;
    }) => any[];
    render(): any;
}