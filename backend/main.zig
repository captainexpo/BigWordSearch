const std = @import("std");
const wsserver = @import("websocket/websocket.zig");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}).init;
    const allocator = gpa.allocator();
    const args = try std.process.argsAlloc(allocator);
    defer std.process.argsFree(allocator, args);

    const port = if (args.len > 1)
        std.fmt.parseInt(u16, args[1], 10) catch 8080
    else
        8080;

    wsserver.startWebsocket(allocator, port, "/home/ethroop/Documents/Github/BigWordSearch/data/words.txt") catch |err| {
        std.log.err("Error starting websocket server: {}\n", .{err});
        return err;
    };
}
