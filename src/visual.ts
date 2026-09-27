"use strict";

import { wasmBase64 } from "./doom-wasm";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import "./../style/visual.less";

import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;

import { VisualFormattingSettingsModel } from "./settings";

import * as d3 from "d3";
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;

var memory = new WebAssembly.Memory({ initial: 108 })
var canvas = null;

var pressKey = null;
var releaseKey = null;

function readWasmString(offset: any, length: any) {
  const bytes = new Uint8Array(memory.buffer, offset, length)
  return new TextDecoder("utf8").decode(bytes)
}

function consoleLogString(offset: any, length: any) {
  const string = readWasmString(offset, length)
  console.log('"' + string + '"')
}

function appendOutput(style: any) {
  return function (offset, length) {}
}

function getMilliseconds() {
  return performance.now()
}

const doom_screen_width = 320 * 2
const doom_screen_height = 200 * 2

function rgbaToHex(r, g, b) {
  return (
    "#" +
    [r, g, b].map((x) => Math.round(x).toString(16).padStart(2, "0")).join("")
  )
}

function averageBlockColour(data, startX, startY, width, blockSize) {
  let r = 0, g = 0, b = 0;

  for (let y = startY; y < startY + blockSize; y++) {
    for (let x = startX; x < startX + blockSize; x++) {
      const i = (y * width + x) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
    }
  }

  const size = blockSize * blockSize;
  return rgbaToHex(r / size, g / size, b / size);
}

function drawCanvas(ptr) {
  const doom_screen = new Uint8ClampedArray(
    memory.buffer,
    ptr,
    doom_screen_width * doom_screen_height * 4
  )

  const gradientDiv = document.getElementById("gradientScreen")

  const blockSize = 2 // downsample 2x2 pixels 320x200
  const scaledWidth = doom_screen_width / blockSize
  const scaledHeight = doom_screen_height / blockSize

  const layers = []
  const positions = []
  const sizes = []

  const vwu = 100 / scaledWidth
  const vhu = 100 / scaledHeight

  for (let y = 0; y < doom_screen_height; y += blockSize) {
    let stops = []
    let prevColor = null
    let segmentStart = 0

    for (let x = 0; x < doom_screen_width; x += blockSize) {
      const avgColor = averageBlockColour(
        doom_screen,
        x,
        y,
        doom_screen_width,
        blockSize
      )

      if (prevColor === null) {
        prevColor = avgColor
        segmentStart = x / blockSize
      } else if (avgColor !== prevColor) {
        stops.push(
          `${prevColor} ${segmentStart * vwu}%, ${prevColor} ${
            (x * vwu) / blockSize
          }%`
        )
        segmentStart = x / blockSize
        prevColor = avgColor
      }
    }
    stops.push(
      `${prevColor} ${segmentStart * vwu}%, ${prevColor} ${scaledWidth * vwu}%`
    )

    layers.push(`linear-gradient(to right, ${stops.join(", ")})`)
    positions.push(`0px ${(y * vhu * 0.99) / blockSize}%`)
    sizes.push(`${scaledWidth * vwu}% ${vhu}%`)
  }

  // Apply layers as CSS background
  gradientDiv.style.backgroundImage = layers.join(", ")
  gradientDiv.style.backgroundPosition = positions.join(", ")
  gradientDiv.style.backgroundSize = sizes.join(", ")
  gradientDiv.style.backgroundRepeat = "no-repeat"
}

var importObject = {
  js: {
    js_console_log: appendOutput("log"),
    js_stdout: appendOutput("stdout"),
    js_stderr: appendOutput("stderr"),
    js_milliseconds_since_start: getMilliseconds,
    js_draw_screen: drawCanvas,
  },
  env: {
    memory: memory,
  },
}

export class Visual implements IVisual {
    private formattingSettings: VisualFormattingSettingsModel;
    private formattingSettingsService: FormattingSettingsService;

    private root: Selection<any>;

    constructor(options: VisualConstructorOptions) {
      this.formattingSettingsService = new FormattingSettingsService();
      this.root = d3.select(options.element);

        var bigHolder = this.root
          .append("div")
          .classed("big-holder", true);

        var gradientScreen = bigHolder
          .append("div")
          .attr("id", "gradientScreen")

        canvas = bigHolder
            .append("canvas")
            .attr("id", "screen")
            .node();


const wasmBytes = Uint8Array.from(
    atob(wasmBase64),
    c => c.charCodeAt(0)
);


document.addEventListener("keydown", (event) => { 
if (event.code == "ArrowLeft") {
  pressKey(0xAC);  
} else if (event.code == "ArrowRight") {
  pressKey(0xAE);  
} else if (event.code == "ArrowUp") {
  pressKey(0xAD);  
} else if (event.code == "ArrowDown") {
  pressKey(0xAF);  
} else if (event.code == "Enter") {
  pressKey(event.keyCode);
} else if (event.code == "Space") {
  pressKey(event.keyCode);
} else if (event.code == "ControlRight" || event.code == "ControlLeft") {
  pressKey(0x80+0x1D);
}
});

document.addEventListener("keyup", (event) => { 
if (event.code == "ArrowLeft") {
  releaseKey(0xAC);
} else if (event.code == "ArrowRight") {
  releaseKey(0xAE);  
} else if (event.code == "ArrowUp") {
  releaseKey(0xAD);  
} else if (event.code == "ArrowDown") {
  releaseKey(0xAF);  
} else if (event.code == "Enter") {
  releaseKey(event.keyCode);
} else if (event.code == "Space") {
  releaseKey(event.keyCode);
} else if (event.code == "ControlRight" || event.code == "ControlLeft") {
  releaseKey(0x80+0x1D);
}
});

WebAssembly.instantiate(wasmBytes, importObject).then(
//WebAssembly.instantiateStreaming(fetch("https://grahamthe.dev/demos/doom/doom.wasm"), importObject).then(
  (obj: any) => {
    obj.instance.exports.main();

    /*input handling*/
    let doomKeyCode = function (keyCode) {
      // Doom seems to use mostly the same keycodes, except for the following (maybe I'm missing a few.)
      switch (keyCode) {
        case 8:
          return 127 // KEY_BACKSPACE
        case 17:
          return 0x80 + 0x1d // KEY_RCTRL
        case 18:
          return 0x80 + 0x38 // KEY_RALT
        case 37:
          return 0xac // KEY_LEFTARROW
        case 38:
          return 0xad // KEY_UPARROW
        case 39:
          return 0xae // KEY_RIGHTARROW
        case 40:
          return 0xaf // KEY_DOWNARROW
        default:
          if (keyCode >= 65 /*A*/ && keyCode <= 90 /*Z*/) {
            return keyCode + 32 // ASCII to lower case
          }
          if (keyCode >= 112 /*F1*/ && keyCode <= 123 /*F12*/) {
            return keyCode + 75 // KEY_F1
          }
          return keyCode
      }
    }
    let keyDown = function (keyCode) {
      obj.instance.exports.add_browser_event(0 /*KeyDown*/, keyCode)
    }
    let keyUp = function (keyCode) {
      obj.instance.exports.add_browser_event(1 /*KeyUp*/, keyCode)
    }

    pressKey = keyDown;
    releaseKey = keyUp;

    /*keyboard input*/
    canvas.addEventListener(
      "keydown",
      function (event) {
        keyDown(doomKeyCode(event.keyCode))
        event.preventDefault()
      },
      false
    )
    canvas.addEventListener(
      "keyup",
      function (event) {
        keyUp(doomKeyCode(event.keyCode))
        event.preventDefault()
      },
      false
    );

    // /*mobile touch input*/
    // [
    //   ["enterButton", 13],
    //   ["leftButton", 0xac],
    //   ["rightButton", 0xae],
    //   ["upButton", 0xad],
    //   ["downButton", 0xaf],
    //   ["ctrlButton", 0x80 + 0x1d],
    //   ["spaceButton", 32],
    //   ["altButton", 0x80 + 0x38],
    // ].forEach(([elementID, keyCode]: any) => {
    //   console.log(elementID + " for " + keyCode)
    //   var button = document.getElementById(elementID)
    //   //button.addEventListener("click", () => {keyDown(keyCode); keyUp(keyCode)} );
    //   button.addEventListener("touchstart", () => keyDown(keyCode))
    //   button.addEventListener("touchend", () => keyUp(keyCode))
    //   button.addEventListener("touchcancel", () => keyUp(keyCode))
    // })

    /*hint that the canvas should have focus to capute keyboard events*/
    const focushint = document.getElementById("focushint")
    const printFocusInHint = function (e) {
      // focushint.innerText =
      //   "Doom focused, if input stops working focus the game again"
      // focushint.style.fontWeight = "normal"
    }
    canvas.addEventListener("focusin", printFocusInHint, false)

    canvas.addEventListener(
      "focusout",
      function (e) {
        // focushint.innerText =
        //   "Click on the Doom game to capute input and start playing."
        // focushint.style.fontWeight = "bold"
      },
      false
    )

    canvas.focus()
    printFocusInHint(null)

    /*Main game loop*/
    function step(timestamp) {
      obj.instance.exports.doom_loop_step()
      window.requestAnimationFrame(step)
    }
    window.requestAnimationFrame(step)
  }
).catch(err => {
  console.error("Failed to load WebAssembly:", err);
});

    }

    public update(options: VisualUpdateOptions) {
        this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(VisualFormattingSettingsModel, options.dataViews[0]);
        canvas.focus()
    }

    /**
     * Returns properties pane formatting model content hierarchies, properties and latest formatting values, Then populate properties pane.
     * This method is called once every time we open properties pane or when the user edit any format property. 
     */
    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
    }
}