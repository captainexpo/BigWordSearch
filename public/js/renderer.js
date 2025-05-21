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

let textLayer = new Konva.FastLayer({ listening: true});
let cursorLayer = new Konva.Layer({ listening: false });

stage.add(textLayer);

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
    bounds.x1 = Math.min(bounds.x1, 500);
    bounds.y1 = Math.min(bounds.y1, 500);

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

    for (let _y = 0; _y < data.length; _y++) {
        const y = Math.floor(_y);
        const row = data[y];
        for (let _x = 0; _x < row.length; _x++) {
            const x = Math.floor(_x);
            const gridX = offsetX + x;
            const gridY = offsetY + y;
            const drawX = gridX * cellSize;
            const drawY = gridY * cellSize;

            if (currentScale <= 0.1) {
                // Draw a rectangle instead of text
                const rect = new Konva.Rect({
                    x: drawX + cellSize / 3,
                    y: drawY + cellSize / 3,
                    width: cellSize / 3,
                    height: cellSize / 3,
                    fill: "rgb(140, 140, 140)",
                    stroke: "black",
                    strokeWidth: 1,
                });
                textLayer.add(rect);
                continue;
            }

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
            });

            textLayer.add(text);
        }
    }

    textLayer.draw();
    let endTime = performance.now();
    console.log("Rendering time: ", endTime - startTime, "ms");
}
