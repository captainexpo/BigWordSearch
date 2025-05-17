const std = @import("std");
const ws = @import("websocket");
const Generator = @import("generator.zig").Generator;

var gen: Generator = undefined;

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    const allocator = gpa.allocator();

    gen = try Generator.init(allocator, 10);

    var server = try ws.Server(Handler).init(allocator, .{
        .port = 9224,
        .address = "127.0.0.1",
        .handshake = .{
            .timeout = 3,
            .max_size = 1024,
            // since we aren't using hanshake.headers
            // we can set this to 0 to save a few bytes.
            .max_headers = 0,
        },
    });

    // Arbitrary (application-specific) data to pass into each handler
    // Pass void ({}) into listen if you have none
    var app = App{};

    // this blocks
    try server.listen(&app);
}

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

    // You must defined a public clientMessage method
    pub fn clientMessage(self: *Handler, data: []const u8) !void {
        std.debug.print("clientMessage: {any}\n", .{data});
        const pos = self.parsePositionInput(data) catch |e| {
            std.debug.print("Invalid input: {?}\n", .{e});
            try self.conn.close(.{});
            return;
        };
        std.debug.print("Parsed positions: {any}\n", .{pos});
        const block: []u8 = gen.getBlock(std.heap.page_allocator, pos[0], pos[1], pos[2], pos[3]) catch |e| {
            std.debug.print("Error generating block: {?}\n", .{e});
            try self.conn.close(.{});
            return;
        };

        try self.conn.write(block);
    }
};

// This is application-specific you want passed into your Handler's
// init function.
const App = struct {
    // maybe a db pool
    // maybe a list of rooms
};
