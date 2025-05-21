const socket = new WebSocket("ws://localhost:8081");

socket.onopen = () => {
    updateGrid();
};

socket.onmessage = (event) => {
    //console.log("Message from server: ", event.data);
    let data = JSON.parse(event.data);
    const resultType = data.message;
    if (resultType == "error") {
        console.error("Error from server: ", data.data);
        window.alert("An error has occured, please reload the page.");
        return;
    }

    data = JSON.parse(data.data);
    switch(data.message) {
        case "gridData":
            if (typeof data.data[0] == "number") {
                // If the data is a number, convert it to a string
                data.data = data.data.map((num) => num.toString());

            }
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