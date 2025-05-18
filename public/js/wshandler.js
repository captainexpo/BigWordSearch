const socket = new WebSocket("ws://localhost:8080");

socket.onopen = () => {
    updateGrid();
};

socket.onmessage = (event) => {
    //console.log("Message from server: ", event.data);
    const data = JSON.parse(event.data);
    switch(data.message) {
        case "gridData":
            const gridData = data.data.split("\n");
            //console.log("Grid data: ", gridData, data.offsetX, data.offsetY);
            recievedGridData(gridData, data.offsetX, data.offsetY);
            break;
        default:
            console.error("Unknown message type: ", data.message);
    }
};

function toull(number) {
  const n = BigInt(number) & ((1n << 64n) - 1n); // Clamp to 64 bits
  const buffer = new ArrayBuffer(8); // 8 bytes for 64-bit
  const view = new DataView(buffer);
  view.setBigUint64(0, n, true); // true = little endian
  return new Uint8Array(buffer);
}

function sendMessage(message, data) {
    if (socket.readyState !== WebSocket.OPEN) {
        return false;
    }
    switch(message) {
        case "gridData":
            data = [...toull(data.x), ...toull(data.y), ...toull(data.x1), ...toull(data.y1)];
            break;
        default:
            return false;
    }
    //console.log("Sending message: ", message, data);
    try {
        socket.send(JSON.stringify({ message: message, data: data }));        
    }
    catch (error) {
        return false;
    }
    return true;
}