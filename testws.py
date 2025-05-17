import asyncio
import websockets
import ctypes


async def connect_websocket():
    uri = "ws://localhost:9224"  # Replace with your WebSocket server URI
    async with websockets.connect(uri) as websocket:
        arr = (ctypes.c_longlong * 4)(
            *[ctypes.c_longlong(int(input())) for _ in range(4)]
        )
        print("SENT", arr)
        await websocket.send(bytes(arr))
        response = await websocket.recv()
        print(f"Received: {response}")


if __name__ == "__main__":
    asyncio.run(connect_websocket())
