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

let layer = new Konva.Layer();
stage.add(layer);

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

    //if(currentScale < 0.5) { 
    //    console.log("Scale too small, not sending grid data");
    //    return;
    //}
    sendMessage("gridData", bounds);
}
var updateGrid = debounce(_updateGrid, 100);


// WebSocket-driven
function recievedGridData(data, offsetX, offsetY) {
    let startTime = performance.now();
    layer.destroyChildren();
    for (let y = 0; y < data.length; y++) {
        const row = data[y];
        for (let x = 0; x < row.length; x++) {
            const gridX = offsetX + x;
            const gridY = offsetY + y;
            const drawX = gridX * cellSize;
            const drawY = gridY * cellSize;

            const rect = new Konva.Rect({
                x: drawX,
                y: drawY,
                width: cellSize,
                height: cellSize,
                fill: "black",
                stroke: "#ffffff00",
                strokeWidth: 1,
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
            });

            layer.add(rect);
            layer.add(text);
        }
    }

    layer.draw();
    let endTime = performance.now();
    console.log("Rendering time: ", endTime - startTime, "ms");
}
