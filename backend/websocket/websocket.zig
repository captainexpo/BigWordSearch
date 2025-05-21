const std = @import("std");
const ws = @import("websocket");
const Generator = @import("generator.zig").Generator;

var gen: Generator = undefined;

pub fn startWebsocket(allocator: std.mem.Allocator, port: u16, wordsPath: []const u8) !void {
    gen = try Generator.init(allocator, 500);
    try gen.readWordsFromFile(wordsPath, allocator);

    var server = try ws.Server(Handler).init(allocator, .{
        .port = port,
        .address = "127.0.0.1",
        .handshake = .{
            .timeout = 3,
            .max_size = 1024,
            .max_headers = 0,
        },
    });

    // Arbitrary (application-specific) data to pass into each handler
    // Pass void ({}) into listen if you have none
    var app = App{
        .allocator = allocator,
    };

    // this blocks
    try server.listen(&app);
}

const MessageJSON = struct { message: []const u8, data: []const u8 };
// This is your application-specific wrapper around a websocket connection
const Handler = struct {
    app: *App,
    conn: *ws.Conn,
    // You must define a public init function which takes
    pub fn init(h: *ws.Handshake, conn: *ws.Conn, app: *App) !Handler {
        // `h` contains the initial websocket "handshake" request
        // It can be used to apply application-specific logic to verify / allow
        // the connection (e.g. valid url, query string parameters, or headers)

        _ = h; // we're not using this in our simple case

        return .{
            .app = app,
            .conn = conn,
        };
    }

    pub fn parsePositionInput(self: *Handler, data: []const u8) ![4]u64 {
        _ = self;
        // Expecting 32 bytes: 4 * 8 bytes (u64) in big-endian order
        if (data.len != 32) {
            return error.InvalidInputLength;
        }
        var result: [4]u64 = undefined;
        inline for (&result, 0..4) |*val, i| {
            const start = i * 8;
            const end = start + 8;
            val.* = std.mem.readInt(u64, data[start..end], .little);
        }
        return result;
    }

    const GridData = struct {
        message: []const u8,
        data: []const u8,
        offsetX: u64,
        offsetY: u64,
    };
    pub fn sendGridData(self: *Handler, message: []const u8, data: []const u8) ![]u8 {
        //std.debug.print("clientMessage: {any}\n", .{data});
        const pos = self.parsePositionInput(data) catch |e| {
            std.log.warn("Invalid input: {?}\n", .{e});
            return e;
        };
        //std.debug.print("Parsed positions: {any}\n", .{pos});
        const block = gen.getBlock(self.app.allocator, pos[0], pos[1], pos[2], pos[3]) catch |e| {
            std.log.err("Error generating block: {?}\n", .{e});
            return e;
        };
        var returnMessage = std.ArrayList(u8).init(self.app.allocator);
        defer returnMessage.deinit();
        try std.json.stringify(
            GridData{
                .message = message,
                .data = block,
                .offsetX = pos[0],
                .offsetY = pos[1],
            },
            .{},
            returnMessage.writer(),
        );
        return try returnMessage.toOwnedSlice();
    }

    pub fn handleMessage(self: *Handler, data: []const u8) ![]u8 {
        const startTime = std.time.microTimestamp();
        const message = std.json.parseFromSlice(MessageJSON, self.app.allocator, data, .{}) catch |e| {
            std.log.err("Error parsing {s}: {?}\n", .{ data, e });
            return e;
        };
        defer message.deinit();

        var result: []u8 = "";
        if (std.mem.eql(u8, message.value.message, "gridData")) {
            result = try self.sendGridData(message.value.message, message.value.data);
        } else {
            return error.InvalidMessage;
        }
        std.debug.print("Time taken: {d}ms\n", .{std.time.microTimestamp() - startTime});
        return result;
    }

    // You must defined a public clientMessage method
    pub fn clientMessage(self: *Handler, data: []const u8) !void {
        var result = std.ArrayList(u8).init(self.app.allocator);
        const r = self.handleMessage(data) catch |e| {
            std.log.err("Error handling message: {?}\n", .{e});
            try std.json.stringify(MessageJSON{
                .data = "",
                .message = "error",
            }, .{}, result.writer());
            defer result.deinit();
            try self.conn.write(try result.toOwnedSlice());
            try self.conn.close(.{ .code = 1000, .reason = "error" });
            return e;
        };

        try std.json.stringify(MessageJSON{
            .data = r,
            .message = "success",
        }, .{}, result.writer());
        defer result.deinit();
        const resultStr = try result.toOwnedSlice();
        //std.debug.print("Sending message: {s}\n", .{resultStr});
        try self.conn.write(resultStr);
    }
};

// This is application-specific you want passed into your Handler's
// init function.
const App = struct {
    allocator: std.mem.Allocator,
};
