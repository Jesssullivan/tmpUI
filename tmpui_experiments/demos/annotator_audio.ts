import {audio_loader, audio_utils, spectrogram_utils} from "../src";

/**
 *  annotator_audio.ts
 *
 * implementations of `annotator_tool` for annotating spectrograms.
 *
 * build only this file:
 * ` npm run-script build-anno-audio `
 *
 * build all files:
 * ` npm run-script develop-anno-demos `
 */

// selector:
const $ = require('jquery');

// variables to keep of things while we annotate:
let annotatorRendered: any = null;
let spectrogram_width: number = null;
let spectrogram_height: number = null;
let currentImageIndex: number = 0;

/**
 * class SpectrogramPlayer() provides access to variety of mel spectrogram-related methods,
 * e.g. generating, annotating, audio / visual playback, etc
 *
 * each spectrogram is generated in the browser, using the audio url
 * specified in images.json at:
 * [image_info['audio']]
 */

/**
 * Audio Interface to keep track of mutable types
 * while playing back audio / annotating spectrogram
 */
interface AudioInterface {

    // space bar is play and pause
    pixels_per_second: number;
    pixels_per_ms: number;

    // the interval that we should pan the spectrogram at:
    pan_interval_ms: number;
    audioElement: any;
    playing_audio: boolean;
    playing_audio_timing_id: number;

    // our current pixel offset in the image:
    current_offset: number;

}

/**
 * AudioPlayer() implements various audio playback controls,
 * bound to the user's keyboard.
 *
 * @RightArrow forward
 * @LeftArrow backward
 * @Spacebar play / pause
 */
class AudioPlayer implements AudioInterface {

     // the interval that we should pan the spectrogram at:
    pan_interval_ms: number = 100;
    pixels_per_second: number = null;
    current_offset: number;
    playing_audio: boolean = false;
    playing_audio_timing_id: any = null;
    audioElement: any;
    pixels_per_ms: number;

    panSpectrogram = (): void => {

        const currentTime = this.audioElement.currentTime;
        const offset = this.pixels_per_second * currentTime;

        annotatorRendered.panTo(offset);

        this.current_offset = offset;

    }

    audioEnded = (): void => {

        clearInterval(this.playing_audio_timing_id);
        this.playing_audio = false;

    }

    startPlaying = (): void => {

        if (this.audioElement != null) {

            this.audioElement.currentTime = this.current_offset / this.pixels_per_second;

            // If the user "focused" on an annotation, then our offset position that is rendered is off.
            // So make sure to "re-pan" the map to the current offset.
            annotatorRendered.panTo(this.current_offset);

            this.audioElement.onended = this.audioEnded;
            this.audioElement.play();

            this.playing_audio_timing_id = setInterval(this.panSpectrogram, this.pan_interval_ms);
            this.playing_audio = true;

        }
    }

    stopPlaying = (): void => {

        if (this.audioElement != null && !this.audioElement.paused) {

            this.audioElement.pause();
            clearInterval(this.playing_audio_timing_id);

        }

        this.playing_audio = false;
    }

    goForward = () => {

        if(this.current_offset >= spectrogram_width) {
            return;
        }

        if (this.playing_audio) {
            this.stopPlaying();
        }

        this.current_offset = Math.min(spectrogram_width, this.current_offset + 100);

        annotatorRendered.panTo(this.current_offset);

    }

    goBackward = () => {

        if(this.current_offset === 0) {
            return;
        }

        if (this.playing_audio) {
            this.stopPlaying();
        }

        this.current_offset = Math.max(0, this.current_offset - 100);
        annotatorRendered.panTo(this.current_offset);
    }

    handleKeyDown = (e:any): void => {

            const PLAY_PAUSE_KEY = 32;
            const RIGHT_ARROW_KEY = 39; // Forward
            const LEFT_ARROW_KEY = 37; // Backward

            switch(e.keyCode) {

            case PLAY_PAUSE_KEY:
                default:
                if (e.target === document.body) {
                    if (this.playing_audio) {
                        this.stopPlaying();
                    } else {
                        this.startPlaying();
                    }
                    e.preventDefault(); // prevent the space button from scrolling
                }
                break;

            case RIGHT_ARROW_KEY:
            this.goForward();
            break;

            case LEFT_ARROW_KEY:
            this.goBackward();
            break;
        }

    }

    enableAudioKeys = (): void => {
        // Register keypresses
        document.addEventListener("keydown", this.handleKeyDown);
    }

    disableAudioKeys = (): void => {
        // Unregister keypresses
        document.removeEventListener("keydown", this.handleKeyDown);
    }

}

interface SpectrogramInterface {

    // Spectrogram Parameters:
    targetSpectrogramHeight: number;
    targetSampleRate: number;
    stftWindowSeconds: number;
    stftHopSeconds: number;
    topDB: number;
    window_length_samples: number;
    hop_length_samples: number;
    fft_length: number;
}

/**
 *
 * Spectrogram.generate(image_info):
 *
 * generates a new mel spectrogram in the browser.
 * (opposed to fetch from online source, e.g. Macaulay)
 *
 * @returns Image() Element; spectrogram png image to display @ `ImageEl.src`
 * @param image_info parsed image information from images.json
 */
export class SpectrogramPlayer extends AudioPlayer implements SpectrogramInterface {

    // Spectrogram Visualization Parameters:
    targetSpectrogramHeight = 300;
    targetSampleRate = 44100;
    stftWindowSeconds = 0.015;
    stftHopSeconds = 0.005;
    topDB = 80;
    window_length_samples = Math.round(this.targetSampleRate * this.stftWindowSeconds);
    hop_length_samples = Math.round(this.targetSampleRate * this.stftHopSeconds);
    fft_length = Math.pow(2, Math.ceil(Math.log(this.window_length_samples) / Math.log(2.0)));

    generate = async(image_info: { [image_info: string]: any; }): Promise<HTMLImageElement> => {

        const audioURL: string = [image_info['audio']].toString();

        const spec_params = {
            sampleRate: this.targetSampleRate,
            hopLength: this.hop_length_samples,
            winLength: this.window_length_samples,
            nFft: this.fft_length,
            topDB: this.topDB
        };

        // atm, all processing of spectrogram generated in the browser occurs
        // within the fulfillment of `audioWaveform` Promise.
        return audio_loader.loadAudioFromURL(audioURL)
            .then((audioBuffer) => audio_loader.resampleAndMakeMono(audioBuffer, this.targetSampleRate))
            .then((audioWaveform) => {

                // generate dB spectrogram-
                const dbSpec = audio_utils.dBSpectrogram(audioWaveform, spec_params);

                // make an image we can display:
                const imageEl = new Image();

                imageEl.src = spectrogram_utils.dBSpectrogramToImage(dbSpec, this.topDB);
                imageEl.height = this.targetSpectrogramHeight;
                imageEl.width = Math.round(dbSpec.length);

                return imageEl;

            });
    }
}

/**
 * function startAnnotating initializes & loads up an annotator.
 *
 * @param images_data
 * @param categories
 * @param annotations
 * @param config
 */
function startAnnotating(images_data: any[], categories: any,

    annotations: Array<{ [x: string]: any; }>, config: {
        quickAccessCategoryIDs: any[];
        annotationFilePrefix: string; }) {

    // Audio & Spectrogram functions:
    const spectrogram = new SpectrogramPlayer();

    if (images_data.length === 0) {
        alert("Error: No images?");
        return;
    }

    // Parse the config dict
    console.log(config);
    const quickAccessCatIDs = config.quickAccessCategoryIDs || [];
    const annotation_file_prefix = config.annotationFilePrefix || "";

    const image_id_to_annotations:any = {};

    images_data.forEach((image_info: any) => {
        image_id_to_annotations[image_info['id']] = [];
    });

    annotations.forEach((anno: { [x: string]: any; }) => {
        const image_id = anno['image_id'];
        image_id_to_annotations[image_id].push(anno);
    });

    /**
     * annotateImage:
     *
     * select which item to annotate by imageIndex.
     *
     * @param imageIndex
     */
    async function annotateImage(imageIndex: number) {

        const image_info = images_data[imageIndex];

        const existing_annotations = image_id_to_annotations[image_info.id];

        if (annotatorRendered != null) {

            // There was a previous image, make sure to unmount it (and stop audio):
            spectrogram.stopPlaying();
            spectrogram.disableAudioKeys();

            // @ts-ignore
            ReactDOM.unmountComponentAtNode(document.getElementById("annotationHolder"));
            annotatorRendered = null;

        }

        $("#currentImageProgress").text('Image ' + (imageIndex + 1) + ' / ' + images_data.length);

        $("#currentAudioDuration").text('Dur: ? sec');

        if (imageIndex === 0) {
            $("#previousImageButton").prop("disabled", true);
        } else {
            $("#previousImageButton").prop("disabled", false);
        }

        if (imageIndex === images_data.length - 1) {
            $("#nextImageButton").prop("disabled", true);
        } else {
            $("#nextImageButton").prop("disabled", false);
        }

        // show a loader graphic, can take a while to draw a big spectrogram:
        document.getElementById("waitLoader").style.visibility = "visible";

        // generate & display a spectrogram:
        spectrogram.generate(image_info)
            .then((imageEl) => {

                // Get the dimensions of the spectrogram:
                spectrogram_height = imageEl.height;
                spectrogram_width = imageEl.width;

                // remove loader:
                document.getElementById("waitLoader").style.visibility = "hidden";

                function addAudioFunctions(annotatorRendered: {
                    renderForSpectrogram: (arg0: any) => void;
                    turnOffZoom: () => void;
                    turnOffDrag: () => void; })
                {

                    // Setup the view for the audio
                    annotatorRendered.renderForSpectrogram(spectrogram.targetSpectrogramHeight);
                    annotatorRendered.turnOffZoom();
                    annotatorRendered.turnOffDrag();

                    // Audio Controls
                    // space bar is play and pause
                    spectrogram.pixels_per_second = null;
                    spectrogram.pixels_per_ms = null;

                    spectrogram.audioElement = new Audio();
                    spectrogram.playing_audio = false;
                    spectrogram.playing_audio_timing_id = null;
                    spectrogram.current_offset = 0;

                    // Load in the audio for the spectrogram:
                    spectrogram.audioElement.addEventListener('canplaythrough', () => {

                        // The duration variable now holds the duration (in seconds) of the audio clip
                        const duration = spectrogram.audioElement.duration;

                        // This should be ~250 (because of the SoX command)
                        spectrogram.pixels_per_second = spectrogram_width / duration;

                        spectrogram.pixels_per_ms = spectrogram.pixels_per_second / 1000.0;

                        console.log("Spectrogram Height: " +  spectrogram_height);
                        console.log("Spectrogram Width: " +  spectrogram_width);
                        console.log("Duration " + duration.toString());
                        console.log("Pixels / second : " + spectrogram.pixels_per_second);
                        console.log("Pixels / millisecond : " + spectrogram.pixels_per_ms);
                        console.log("Current Time " + spectrogram.audioElement.currentTime);

                        spectrogram.enableAudioKeys();

                        $("#currentAudioDuration").text('Dur: ' + duration.toFixed(2) + ' sec');

                    });

                    spectrogram.audioElement.src = image_info.audio;

                    spectrogram.audioElement.addEventListener('error', () => {
                        alert("Error loading the audio for image " + image_info.id + ". Perhaps the resource has been deleted? Maybe skip?");
                    });

                    spectrogram.audioElement.load();

                }

                function delayAudioPrepTillRender(annotatorRendered: {
                    renderForSpectrogram: (arg0: any) => void;
                    turnOffZoom: () => void;
                    turnOffDrag: () => void; })
                {

                    if (!('audio' in image_info)) {
                        console.log("No audio url in image info");
                        return;
                    }

                    // Annoying, but we need leaflet to render the image before we start
                    // doing transformations
                    setTimeout(() => addAudioFunctions(annotatorRendered), 80);

                }

                /**
                 * Create the Leaflet.annotation element:
                 */
                // @ts-ignore
                const annotator = React.createElement(document.LeafletAnnotation, {
                    imageElement : imageEl,
                    image : image_info,
                    annotations : existing_annotations,
                    categories,
                    options : {
                        enableEditingImmediately : true,
                        map : {
                            attributionControl : false,
                            zoomControl : false,
                            boxZoom : false,
                            doubleClickZoom : false,
                            keyboard : false,
                            scrollWheelZoom : false
                        },

                        quickAccessCategoryIDs : quickAccessCatIDs,

                        newInstance: {
                            annotateCategory: true,
                            annotateSupercategory: false,
                            annotationType: 'box'
                        },

                        duplicateInstance : {
                            enable : true,
                            duplicateY : true  // duplicate the frequency components of the box
                        },

                        showCategory : true,
                        showSupercategory: true,
                        showIsCrowdCheckbox: true,

                        renderBoxes : true,

                        didMountLeafletCallback : delayAudioPrepTillRender
                    }
                }, null);

                /**
                 *  Render the annotator:
                 */
                // @ts-ignore
                annotatorRendered = ReactDOM.render(annotator, document.getElementById('annotationHolder'));

                imageEl.addEventListener('error', () => {
                    alert("Error loading the pixels for image " + image_info.id + ". Perhaps the resource has been deleted? Maybe skip?");

                });

            });

    }

    function saveCurrentAnnotations() {

        // It could be the case that the image or audio failed to load, in which case we wouldn't have a `annotatorRendered`
        if (annotatorRendered != null) {
            const annos = annotatorRendered.getAnnotations({
                modifiedOnly : false,
                excludeDeleted : true
            });

            const image_id = images_data[currentImageIndex].id;
            image_id_to_annotations[image_id] = annos;
        }

    }

    function classifyCurrentAnnotations() {

        saveCurrentAnnotations();

        const image_id = images_data[currentImageIndex].id;
        console.log(image_id_to_annotations[image_id]);

    }

    $("#nextImageButton").on('click', () => {

        saveCurrentAnnotations();

        if(currentImageIndex < images_data.length - 1){
            currentImageIndex += 1;
            annotateImage(currentImageIndex);
        }

        document.getElementById("nextImageButton").blur();

    });

    $("#previousImageButton").on('click', () =>{

        saveCurrentAnnotations();

        if(currentImageIndex > 0) {
            currentImageIndex -= 1;
            annotateImage(currentImageIndex);
        }

        document.getElementById("previousImageButton").blur();

    });

    function goToImage() {

        saveCurrentAnnotations();

        let index = -1;

        try {
            // tslint:disable-next-line:radix
            index = parseInt($("#goToImageInput").val());
            index = index - 1; // account for 0 indexing
        }
        catch(err) {
            return;
        }

        if (index >= 0 && index < images_data.length) {
            currentImageIndex = index;
            annotateImage(currentImageIndex);
        }
    }

    $("#goToImageButton").click(() => {

        document.getElementById("goToImageButton").blur();

        goToImage();

    });

    document.getElementById("goToImageInput").addEventListener('keyup', ({key}) => {
        if (key === "Enter"){
            document.getElementById("goToImageInput").blur();
            goToImage();
        }
    });

    // Allow the annotations to be downloaded
    $("#exportAnnos").click(() => {

        saveCurrentAnnotations();

        let annos: any[] = [];

        images_data.forEach((image_info: { id: string | number; }) => {
            annos = annos.concat(image_id_to_annotations[image_info.id]);
        });

        console.log("Exporting " + annos.length + " annotations");
        console.log(annos);

        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(annos));
        const downloadAnchorNode = document.createElement('a');

        downloadAnchorNode.setAttribute("href",     dataStr);
        downloadAnchorNode.setAttribute("download", annotation_file_prefix + "annotations.json");

        document.body.appendChild(downloadAnchorNode); // required for firefox

        downloadAnchorNode.click();
        downloadAnchorNode.remove();

        alert("Exported a total of " + annos.length + " annotations");

        document.getElementById("exportAnnos").blur();

    });

    // HACK: trying to make the spacebar play the audio after modifying an annotation
    // this seems to be working....
    document.addEventListener("mouseup", (e) => {
        try {
            if (document.activeElement) {
                // @ts-ignore
                if (!(e.target.tagName.toUpperCase() === 'INPUT')) {
                    // @ts-ignore
                    document.activeElement.blur();
                }
            }
        }
        catch {
            console.log('error with spacebar event listener, continuing...');
        }
    });

    // Kick everything off.
    annotateImage(currentImageIndex);

}

/**
 * Allows the user to choose a directory.
 */
document.querySelector('#customFile').addEventListener('change', (ev)=> {

    ev.preventDefault();

    const local_image_data: Array<{ id: any; url: any; attribution: string; }> = [];

    let image_json_promise = null;
    let category_json_promise = null;
    let annotation_json_promise = null;
    let config_json_promise = null;

    // @ts-ignore
    for(let i = 0; i < ev.target.files.length; i++){
        // @ts-ignore
        const item = ev.target.files[i];

        // Is this an image?
        if (item.type === "image/jpeg" || item.type === "image/png"){

            const image_id = item.name.split('.')[0];

            local_image_data.push({
                id : image_id,
                url: item.webkitRelativePath,
                attribution : "N/A"
            });

        }

        // Processing input files / annotation task directory:
        // Is this a json file?
        else if (item.type === "application/json") {

            if (item.name === 'images.json') {
                image_json_promise = item.text().then((text: string) => JSON.parse(text));
            }

            else if (item.name === 'categories.json') {

                category_json_promise = item.text().then((text: string) => JSON.parse(text));

            }

            else if (item.name.includes('annotations.json')) {

                annotation_json_promise = item.text().then((text: string) => JSON.parse(text));

            }

            else if (item.name === 'config.json') {

                config_json_promise = item.text().then((text: string) =>JSON.parse(text) );

            }

            else {
                console.log("Ignoring " + item.name + " (not sure what to do with it).");
            }

        }

        else {
            console.log("Ignoring " + item.name + " (not sure what to do with it).");
        }

    }

    // Wait for all the file loading to finish
    Promise.all([image_json_promise, category_json_promise, annotation_json_promise, config_json_promise]).then(

        ([image_data, category_data, annotation_data, config_data]) => {

            if (local_image_data.length > 0 && image_data != null) {
                alert("ERROR: Found image files (jpgs/ pngs) and an images.json file. Not sure which to use! Please remove one or the other.");
                return;
            }

            if (local_image_data.length > 0) {

                image_data = local_image_data;

                // If we loaded in images from the file system, then assume we should sort by filename

                image_data.sort((a: { url: string; }, b: { url: string; }) => {

                    const nameA = a.url.toUpperCase(); // ignore upper and lowercase
                    const nameB = b.url.toUpperCase(); // ignore upper and lowercase

                    if (nameA < nameB) {
                        return -1;
                    }

                    if (nameA > nameB) {
                        return 1;
                    }

                    // names must be equal
                    return 0;
                });

            }

            if (category_data == null) {
                alert("Didn't find a category.json file. This needs to be created.");
                return;
            }

            // Did we find any existing annotations for the images?
            if (annotation_data == null) {
                annotation_data = [];
            }

            // Did the user specify any quick access category ids?
            // const quickAccessCatIDs = getQuickAccessCategoryIDs();
            const quickAccessCatIDs: any = null;

            // Did we get a config file?
            const default_config = {
                "annotationFilePrefix" : "",
                "quickAccessCategoryIDs" : quickAccessCatIDs,
            };

            if (config_data != null) {

                /*
                // Try to merge the quick access category ids
                let mergedCategoryIds = null;
                if ("quickAccessCategoryIDs" in config_data && config_data.quickAccessCategoryIDs.length > 0) {
                    if (default_config.quickAccessCategoryIDs.length > 0) {
                        const a = default_config.quickAccessCategoryIDs;
                        const b = config_data.quickAccessCategoryIDs;
                        mergedCategoryIds = a.concat(b.filter((item: any) => a.indexOf(item) < 0));
                    }
                }
                */

                /*
                if generateSpectrogram is true, we will not load the remote jpeg version from Macaulay- instead:
                  - for each audio url, generate a spectrogram in browser
                  - write out a new images.json with local spectrogram files loaded adjacent in task directory
                  - archive original images.json as images.json.Macaulay
                 */

                // finish up with config.json:
                config_data = Object.assign({}, default_config, config_data);

                /*
                if (mergedCategoryIds != null) {
                    config_data.quickAccessCategoryIDs = mergedCategoryIds;
                }
                */

            } else {
                config_data = default_config;
            }

            // Hide the directory chooser form, and show the annotation task
            document.getElementById("dirChooser").hidden = true;
            document.getElementById("annotationTask").hidden = false;

            startAnnotating(image_data, category_data, annotation_data, config_data);

        });

});

// Try to make sure the user is in Chrome
// See here: https://stackoverflow.com/a/13348618/11337608

// please note,
// that IE11 now returns undefined again for window.chrome
// and new Opera 30 outputs true for window.chrome
// but needs to check if window.opr is not undefined
// and new IE Edge outputs to true now for window.chrome
// and if not iOS Chrome check
// so use the below updated condition

// @ts-ignore
const isChromium = window.chrome;
const winNav = window.navigator;
const vendorName = winNav.vendor;
// @ts-ignore
const isOpera = typeof window.opr !== "undefined";
const isIEedge = winNav.userAgent.indexOf("Edge") > -1;
const isIOSChrome = winNav.userAgent.match("CriOS");

if (isIOSChrome) {
// is Google Chrome on IOS
    alert("This tool is not tested for iOS environments");

} else if (
isChromium !== null &&
typeof isChromium !== "undefined" &&
vendorName === "Google Inc." &&
isOpera === false &&
isIEedge === false
) {
// is Google Chrome
} else {
// not Google Chrome
    alert("This tool needs to be opened with Google Chrome.");
}