const std = @import("std");
const wsserver = @import("websocket/websocket.zig");

pub fn main() !void {
    wsserver.startWebsocket(8080) catch |err| {
        std.debug.print("Error starting websocket server: {}\n", .{err});
        return err;
    };
}
