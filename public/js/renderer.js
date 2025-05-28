
const container = document.getElementById("grid-container");

const TEXT_COLOR = "black";
const FONT_SIZE = 80;



let stage = new Konva.Stage({
    container: "grid-container",
    width: window.innerWidth,
    height: window.innerHeight,
    draggable: true // allows panning
});
stage.on("dragmove", () => {
    updateGrid();
});

let textLayer = new Konva.Layer({ listening: true});
let cursorLayer = new Konva.Layer({ listening: false });
let decorationLayer = new Konva.Layer({ listening: false }); 

stage.add(textLayer);
stage.add(cursorLayer);
stage.add(decorationLayer);

const cellSize = 100;


// Resizing
window.addEventListener("resize", () => {
    stage.width(window.innerWidth);
    stage.height(window.innerHeight);
    updateGrid();
});


// Converts canvas position to grid cell range
function toGridBounds() {
    const scale = stage.scaleX();
    const pos = stage.position();

    const x0 = -pos.x / scale;
    const y0 = -pos.y / scale;
    const x1 = (window.innerWidth - pos.x) / scale;
    const y1 = (window.innerHeight - pos.y) / scale;

    return {
        x: Math.floor(x0 / cellSize),
        y: Math.floor(y0 / cellSize),
        x1: Math.ceil(x1 / cellSize) + 5,
        y1: Math.ceil(y1 / cellSize) + 5,
    };
}

let sentTime = 0;
let alreadyGotAll = false;

const GRID_WIDTH = 100;

function _updateGrid() {
    
    const bounds = toGridBounds();

    if (alreadyGotAll) return;
    if (bounds.x < 0 && bounds.x1 > GRID_WIDTH && bounds.y < 0 && bounds.y1 > GRID_WIDTH) {
        // If the bounds are completely off-screen, don't send a request
        if (alreadyGotAll) return;
        alreadyGotAll = true;
    }
    bounds.x = Math.max(0, bounds.x);
    bounds.y = Math.max(0, bounds.y);
    bounds.x1 = Math.min(bounds.x1, GRID_WIDTH);
    bounds.y1 = Math.min(bounds.y1, GRID_WIDTH);



    //if(currentScale < 0.5) { 
    //    console.log("Scale too small, not sending grid data");
    //    return;
    //}
    if (currentScale < 0.07) {
        recievedGridData(null, bounds.x, bounds.y, bounds.x1, bounds.y1);
        return;
    }
    sendMessage("gridData", bounds);
}
var updateGrid = debounce(_updateGrid, 100);

let textGrid = []

// WebSocket-driven
function recievedGridData(data, offsetX, offsetY, bx, by) {
    if (data == null) {
        // Draw a flat rectangle
        textLayer.destroyChildren();
        const rect = new Konva.Rect({
            x: 0,
            y: 0,
            width: bx * cellSize,
            height: by * cellSize,
            fill: "rgba(255, 255, 255, 0.1)",
            stroke: "black",
            strokeWidth: 0,
        });
        textLayer.add(rect);
        textLayer.draw();
        return;
    }
    let startTime = performance.now();
    textLayer.destroyChildren();

    textGrid = [];

    for (let _y = 0; _y < data.length; _y++) {
        const y = Math.floor(_y);
        const row = data[y];
        let tmp = [];
        for (let _x = 0; _x < row.length; _x++) {
            const x = Math.floor(_x);
            const gridX = offsetX + x;
            const gridY = offsetY + y;
            const drawX = gridX * cellSize;
            const drawY = gridY * cellSize;

            // Draw a transparent rectangle behind the text to increase clickable area
            const hitRect = new Konva.Rect({
                x: drawX,
                y: drawY,
                width: cellSize,
                height: cellSize,
                fill: "rgba(0,0,0,0)", // invisible but catches events
                listening: true,
            });

            const text = new Konva.Text({
                x: drawX,
                y: drawY,
                width: cellSize,
                height: cellSize,
                text: row[x],
                fill: "black",
                fontSize: 80,
                fontFamily: "monospace",
                align: "center",
                verticalAlign: "middle",
                listening: false, // let the rect handle events
            });

            tmp.push(text);
            

            hitRect.on("click", () => clickedText(text));
            hitRect.on("mouseover", () => onhover(text));

            textLayer.add(hitRect);
            textLayer.add(text);

            text.on("click", () => clickedText(text));

            text.on("mouseover", () => onhover(text));
            textLayer.add(text);
        }
        textGrid.push(tmp);
    }

    textLayer.draw();
    let endTime = performance.now();
    console.log("Rendering time: ", endTime - startTime, "ms");
}

let selectedText = {gx: -1, py: -1, text: null};
let hoveredText = null;
function clickedText(node){
    if (selectedText.text === null) {
        selectedText.text = node;
        selectedText.gx = Math.floor(node.x() / cellSize);
        selectedText.gy = Math.floor(node.y() / cellSize);
        stage.draggable(false);
        allowZoom = false;
        node.setAttrs({
            fill: "red",
            fontSize: 80,
        });
    }
    else {
        selectedText.text.setAttrs({
            fill: TEXT_COLOR,
            fontSize: FONT_SIZE,
        });
        
        selectedText.text = null;
        // allow panning and zooming
        stage.draggable(true);
        allowZoom = true;
        if (selectedText.gx == Math.floor(node.x() / cellSize) && selectedText.gy == Math.floor(node.y() / cellSize)) {
            resetWordSelection();
            return;
        }
        console.log("Sending word guess: ", selectedText.gx, selectedText.gy, Math.floor(node.x() / cellSize), Math.floor(node.y() / cellSize));
        sendMessage("wordGuess", {
            x1: selectedText.gx,
            y1: selectedText.gy,
            x2: Math.floor(node.x() / cellSize),
            y2: Math.floor(node.y() / cellSize),
        });
        resetWordSelection();
    }
}

let selectedLine = null;

function onhover(node){
    if (selectedText.text === node) return;
    if (selectedText.text !== null) {
        if (hoveredText !== null) {
            hoveredText.setAttrs({
                fill: TEXT_COLOR,
                fontSize: FONT_SIZE,
            });
        }
        hoveredText = node;
        hoveredText.setAttrs({
            fill: "yellow",
            fontSize: 80,
        });

        // Draw a line from the selected char to the hovered char
        if (selectedLine !== null) {
            selectedLine.destroy();
            selectedLine = null;
        }
        const startX = selectedText.text.x() + cellSize / 2;
        const startY = selectedText.text.y() + cellSize / 2;
        const endX = node.x() + cellSize / 2;
        const endY = node.y() + cellSize / 2;
        selectedLine = new Konva.Line({
            points: [startX, startY, endX, endY],
            stroke: "orange",
            strokeWidth: 4,
            lineCap: "round",
            lineJoin: "round",
            dash: [10, 5],
        });
        cursorLayer.destroyChildren();
        cursorLayer.add(selectedLine);
        cursorLayer.batchDraw();
    }
    else {
        if (hoveredText !== null) {
            hoveredText.setAttrs({
                fill: TEXT_COLOR,
                fontSize: FONT_SIZE,
            });
        }
        hoveredText = null;
        if (selectedLine !== null) {
            selectedLine.destroy();
            selectedLine = null;
            cursorLayer.batchDraw();
        }
    }
}  

function successfullyGotWord(x, y, x1, y1){
    // Get a line between the two points
    const startX = x * cellSize + cellSize / 2;
    const startY = y * cellSize + cellSize / 2;
    const endX = x1 * cellSize + cellSize / 2;
    const endY = y1 * cellSize + cellSize / 2;

    const line = new Konva.Line({
        points: [startX, startY, endX, endY],
        stroke: "green",
        strokeWidth: 5,
        lineCap: "round",
        lineJoin: "round",
    });
    
    decorationLayer.add(line);
    decorationLayer.batchDraw();
}


function resetWordSelection(){
    if (selectedText.text !== null) {
        selectedText.text.setAttrs({
            fill: TEXT_COLOR,
            fontSize: FONT_SIZE,
        });
    }
    if (hoveredText !== null) {
        hoveredText.setAttrs({
            fill: TEXT_COLOR,
            fontSize: FONT_SIZE,
        });
    }
    selectedText = {gx: -1, gy: -1, text: null};
    hoveredText = null;
    if (selectedLine !== null) {
        selectedLine.destroy();
        selectedLine = null;
    }
    cursorLayer.batchDraw();
    stage.draggable(true);
    allowZoom = true;
}