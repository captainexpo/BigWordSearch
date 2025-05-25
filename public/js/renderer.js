const container = document.getElementById("grid-container");

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
let cursorLayer = new Konva.FastLayer();

stage.add(textLayer);
stage.add(cursorLayer);

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

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

let sentTime = 0;

function _updateGrid() {

    const bounds = toGridBounds();
    bounds.x = Math.max(0, bounds.x);
    bounds.y = Math.max(0, bounds.y);
    bounds.x1 = Math.min(bounds.x1, 25);
    bounds.y1 = Math.min(bounds.y1, 25);

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
                fill: "white",
                fontSize: 50,
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
            fill: "white",
            fontSize: 50,
        });
        
        selectedText.text = null;
        // allow panning and zooming
        stage.draggable(true);
        allowZoom = true;
        if (selectedText.gx == Math.floor(node.x() / cellSize) && selectedText.gy == Math.floor(node.y() / cellSize)) {
            return;
        }
        sendMessage("wordGuess", {
            x1: selectedText.gx,
            y1: selectedText.gy,
            x2: Math.floor(node.x() / cellSize),
            y2: Math.floor(node.y() / cellSize),
        });

    }
}

let selectedLine = [];

function onhover(node){
    if (selectedText.text === node) return;
    if (selectedText.text !== null) {
        if (hoveredText !== null) {
            hoveredText.setAttrs({
                fill: "white",
                fontSize: 50,
            });
        }
        hoveredText = node;
        hoveredText.setAttrs({
            fill: "yellow",
            fontSize: 80,
        });
    }
    else {
        if (hoveredText !== null) {
            hoveredText.setAttrs({
                fill: "white",
                fontSize: 50,
            });
        }
        hoveredText = null;
    }
}  

function recievedCursorData(data) {
    // Data is a list of {x: float, y: float}
    cursorLayer.destroyChildren();
    for (let i = 0; i < data.length; i++) {
        const cursor = data[i];
        const circle = new Konva.Circle({
            x: cursor.x,
            y: cursor.y,
            radius: 10,
            fill: "red",
            stroke: "black",
            strokeWidth: 2,
        });
        cursorLayer.add(circle);
    }
    cursorLayer.draw();
}