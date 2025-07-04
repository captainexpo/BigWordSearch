const std = @import("std");
const ws = @import("websocket");
const Generator = @import("generator.zig").Generator;
const WordChecker = @import("wordcheck.zig").WordChecker;
const CursorHandler = @import("cursorhandler.zig").CursorHandler;
const utils = @import("utils.zig");

var gen: Generator = undefined;
var wordChecker: *WordChecker = undefined;
var cursorHandler: *CursorHandler = undefined;

var currentId: u64 = 0;

var clients: std.AutoHashMap(u64, *Handler) = undefined;

pub fn startWebsocket(allocator: std.mem.Allocator, port: u16, wordsPath: []const u8) !void {
    gen = try Generator.init(allocator, 100);
    try gen.readWordsFromFile(wordsPath, allocator);

    clients = std.AutoHashMap(u64, *Handler).init(allocator);

    wordChecker = allocator.create(WordChecker) catch |e| {
        std.log.err("Error creating WordChecker: {?}", .{e});
        return e;
    };
    wordChecker.* = WordChecker.init(allocator, &gen);
    try wordChecker.readFromDictionary("/home/ethroop/Documents/Github/BigWordSearch/data/wiki-100k.txt");

    cursorHandler = allocator.create(CursorHandler) catch |e| {
        std.log.err("Error creating CursorHandler: {?}", .{e});
        return e;
    };
    cursorHandler.* = CursorHandler.init(allocator);

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

const StringMessage = struct {
    message: []const u8,
    data: []const u8,
};

pub fn broadcastAcrossAll(message: []const u8) !void {
    std.log.debug("Broadcasting message: {s} across {d} clients", .{ message, clients.count() });
    var valiter = clients.valueIterator();
    while (valiter.next()) |client| {
        std.log.debug("Broadcasting message to client {d}", .{client.*.user.id});
        try client.*.conn.write(message);
    }
}

const UserData = struct {
    id: u64,
    score: u64,
    username: []const u8,
};

// This is your application-specific wrapper around a websocket connection
const Handler = struct {
    app: *App,
    conn: *ws.Conn,

    user: UserData = .{
        .id = 0,
        .score = 0,
        .username = "anonymous",
    },
    cursorSendThread: std.Thread = undefined,
    cursorThreadRunning: bool = true,

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
            std.log.warn("Invalid input: {?}", .{e});
            return e;
        };
        //std.debug.print("Parsed positions: {any}\n", .{pos});
        const block = gen.getBlock(self.app.allocator, pos[0], pos[1], pos[2], pos[3]) catch |e| {
            std.log.err("Error generating block: {?}", .{e});
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

    pub fn tryGetValue(object: std.json.ObjectMap, key: []const u8) !std.json.Value {
        const value = object.get(key) orelse {
            std.log.err("Error getting value for key {s}", .{key});
            return error.InvalidInput;
        };
        return value;
    }

    pub fn jsonValueSliceToGeneric(self: *Handler, T: type, values: []std.json.Value) ![]T {
        var result = std.ArrayList(T).init(self.app.allocator);
        defer result.deinit();
        for (values) |v| {
            switch (T) {
                u8 => try result.append(@truncate(try utils.toU64(v.integer))),
                u64 => try result.append(try utils.toU64(v.integer)),
                i64 => try result.append(v.integer),
                []const u8 => {
                    const str = v.string;
                    const slice = str.toOwnedSlice(self.app.allocator) catch |e| {
                        std.log.err("Error converting string to slice: {?}", .{e});
                        return e;
                    };
                    try result.append(slice);
                },
                else => {
                    std.log.err("Invalid type: {s}", .{T});
                    return error.InvalidType;
                },
            }
        }
        return try result.toOwnedSlice();
    }

    pub fn handleMessage(self: *Handler, data: []const u8) !struct { []u8, bool } {
        const message = std.json.parseFromSlice(std.json.Value, self.app.allocator, data, .{}) catch |e| {
            std.log.err("Error parsing {s}: {?}", .{ data, e });
            return e;
        };
        defer message.deinit();

        const messageActual = (tryGetValue(message.value.object, "message") catch |e| return e).string;
        var dataActual = (tryGetValue(message.value.object, "data") catch |e| return e);

        std.debug.print("clientMessage: {s}\n", .{(message.value.object.get("message") orelse return error.InvalidInput).string});

        var result: []u8 = "";
        var dosend: bool = true;
        if (std.mem.eql(u8, messageActual, "gridData")) {
            result = try self.sendGridData(messageActual, try jsonValueSliceToGeneric(self, u8, dataActual.array.items));
        } else if (std.mem.eql(u8, messageActual, "wordGuess")) {
            const WordGuessMessage = struct { message: []const u8, data: bool, x: u64, y: u64, x2: u64, y2: u64, user: UserData, word: []u8 };

            //std.debug.print("GOT WORD GUESS\n", .{});
            const x1 = try utils.toU64((dataActual.object.get("x1") orelse {
                return error.InvalidInput;
            }).integer);
            const y1 = try utils.toU64((dataActual.object.get("y1") orelse {
                return error.InvalidInput;
            }).integer);
            const x2 = try utils.toU64((dataActual.object.get("x2") orelse {
                return error.InvalidInput;
            }).integer);
            const y2 = try utils.toU64((dataActual.object.get("y2") orelse {
                return error.InvalidInput;
            }).integer);

            const isWord, const word = try wordChecker.checkWord(x1, y1, x2, y2, true);
            //std.debug.print("Word guess: {d} {d} {d} {d} {}\n", .{ x1, y1, x2, y2, isWord });

            var writer = std.ArrayList(u8).init(self.app.allocator);
            try std.json.stringify(WordGuessMessage{
                .message = "wordGuess",
                .data = isWord,
                .x = x1,
                .y = y1,
                .x2 = x2,
                .y2 = y2,
                .word = word,
                .user = self.user,
            }, .{}, writer.writer());

            // Broadcast the new word guess to all clients
            try broadcastAcrossAll(try writer.toOwnedSlice());

            if (isWord) {
                self.user.score += 1;
                try self.broadcastUpdate();
            }

            dosend = false;
        } else if (std.mem.eql(u8, messageActual, "cursor")) {
            //dataActual.dump();
            const x: f64 = switch (dataActual.object.get("x") orelse return error.InvalidInput) {
                .integer => @floatFromInt((dataActual.object.get("x") orelse return error.InvalidInput).integer),
                .float => (dataActual.object.get("x") orelse return error.InvalidInput).float,
                else => return error.InvalidInput,
            };
            const y: f64 = switch ((dataActual.object.get("y") orelse return error.InvalidInput)) {
                .integer => @floatFromInt((dataActual.object.get("y") orelse return error.InvalidInput).integer),
                .float => (dataActual.object.get("y") orelse return error.InvalidInput).float,
                else => return error.InvalidInput,
            };
            try cursorHandler.addCursor(x, y, self.user.id);
            //std.debug.print("Added cursor: {d} {d}\n", .{ x, y });
        } else if (std.mem.eql(u8, messageActual, "getID")) {
            const IdMsg = struct { message: []const u8, data: u64 };
            const id = self.user.id;
            var r = std.ArrayList(u8).init(self.app.allocator);
            defer r.deinit();
            try std.json.stringify(IdMsg{
                .data = id,
                .message = "getID",
            }, .{}, r.writer());
            result = try r.toOwnedSlice();
        } else if (std.mem.eql(u8, messageActual, "getFoundWords")) {
            const WordPos = struct {
                x1: u64,
                y1: u64,
                x2: u64,
                y2: u64,
            };
            const FoundWordsMessage = struct {
                message: []const u8,
                data: []WordPos,
            };
            var wordArray = std.ArrayList(WordPos).init(self.app.allocator);
            var keyiter = gen.foundWords.keyIterator();
            while (keyiter.next()) |key| {
                try wordArray.append(WordPos{
                    .x1 = key[0],
                    .y1 = key[1],
                    .x2 = key[2],
                    .y2 = key[3],
                });
            }
            var r = std.ArrayList(u8).init(self.app.allocator);
            defer r.deinit();
            try std.json.stringify(FoundWordsMessage{
                .message = "getFoundWords",
                .data = try wordArray.toOwnedSlice(),
            }, .{}, r.writer());
            result = try r.toOwnedSlice();
        } else if (std.mem.eql(u8, messageActual, "getAllUserData")) {
            const UserDataMessage = struct {
                message: []const u8,
                data: []UserData,
            };
            var userArray = std.ArrayList(UserData).init(self.app.allocator);
            var valiter = clients.valueIterator();
            while (valiter.next()) |client| {
                try userArray.append(client.*.user);
            }
            var r = std.ArrayList(u8).init(self.app.allocator);
            defer r.deinit();
            try std.json.stringify(UserDataMessage{
                .message = "getAllUserData",
                .data = try userArray.toOwnedSlice(),
            }, .{}, r.writer());
            result = try r.toOwnedSlice();
        } else if (std.mem.eql(u8, messageActual, "setUsername")) {
            // Set the username for the user
            const username = (dataActual.object.get("username") orelse return error.InvalidInput).string;
            if (username.len == 0) {
                return error.InvalidUsername;
            }
            self.user.username = username;
            // Broadcast the new username to all clients
            try self.broadcastUpdate();
            dosend = false;
        } else {
            //std.log.err("Unknown message type: {s}", .{messageActual});
            return error.UnknownMessageType;
        }

        if (result.len == 0) {
            // If no result was generated, we don't want to send anything
            dosend = false;
        }

        return .{ result, dosend };
    }

    // You must defined a public clientMessage method
    pub fn clientMessage(self: *Handler, data: []const u8) !void {
        var result = std.ArrayList(u8).init(self.app.allocator);
        const r, const dosend = self.handleMessage(data) catch |e| {
            std.log.err("Error handling message: {?}", .{e});
            try std.json.stringify(StringMessage{
                .data = "",
                .message = "error",
            }, .{}, result.writer());
            defer result.deinit();
            try self.conn.write(try result.toOwnedSlice());
            try self.conn.close(.{ .code = 1000, .reason = "error" });
            return e;
        };

        //std.debug.print("Sending message: {s}\n", .{resultStr});
        if (dosend) try self.conn.write(r);
    }

    pub fn close(self: *Handler) !void {
        self.cursorThreadRunning = false;
        self.cursorSendThread.join();

        cursorHandler.removeCursor(self.user.id) catch |e| {
            std.log.err("Error removing cursor: {?}", .{e});
            return e;
        };

        _ = clients.remove(self.user.id);
        self.broadcastLeave() catch |e| {
            std.log.err("Error broadcasting leave message: {?}", .{e});
            return;
        };
    }

    pub fn sendCursorData(self: *Handler) !void {
        const CursorMessage = struct {
            message: []const u8,
            data: []CursorHandler.Cursor,
        };

        var result = std.ArrayList(u8).init(self.app.allocator);
        defer result.deinit();
        const cursors = try cursorHandler.getCursors();
        try std.json.stringify(CursorMessage{ .message = "cursorData", .data = cursors }, .{}, result.writer());
        const resultStr = try result.toOwnedSlice();
        //std.debug.print("Sending message: {s}\n", .{resultStr});
        try self.conn.write(resultStr);
    }

    pub fn repeatSendCursorData(self: *Handler) !void {
        while (self.cursorThreadRunning) {
            std.time.sleep(0.1 * std.time.ns_per_s);
            if (self.cursorThreadRunning) {
                try self.sendCursorData();
            } else return;
        }
    }

    pub fn broadcastJoin(self: *Handler) !void {
        // Broadcast user join message
        const UserJoinMessage = struct {
            message: []const u8,
            user: UserData,
        };
        var joinMessage = std.ArrayList(u8).init(self.app.allocator);
        defer joinMessage.deinit();
        try std.json.stringify(UserJoinMessage{
            .message = "userJoin",
            .user = self.user,
        }, .{}, joinMessage.writer());
        try broadcastAcrossAll(try joinMessage.toOwnedSlice());
    }

    pub fn broadcastUpdate(self: *Handler) !void {
        // Broadcast user update message
        const UserUpdateMessage = struct {
            message: []const u8,
            user: UserData,
        };
        var updateMessage = std.ArrayList(u8).init(self.app.allocator);
        defer updateMessage.deinit();
        try std.json.stringify(UserUpdateMessage{
            .message = "userUpdate",
            .user = self.user,
        }, .{}, updateMessage.writer());
        try broadcastAcrossAll(try updateMessage.toOwnedSlice());
    }

    pub fn broadcastLeave(self: *Handler) !void {
        // Broadcast user leave message
        const UserLeaveMessage = struct {
            message: []const u8,
            user: UserData,
        };
        var leaveMessage = std.ArrayList(u8).init(self.app.allocator);
        defer leaveMessage.deinit();
        try std.json.stringify(UserLeaveMessage{
            .message = "userLeave",
            .user = self.user,
        }, .{}, leaveMessage.writer());
        try broadcastAcrossAll(try leaveMessage.toOwnedSlice());
    }

    pub fn afterInit(self: *Handler) !void {
        self.user.id = currentId;
        currentId += 1;

        clients.put(self.user.id, self) catch |e| {
            std.log.err("Error adding client: {?}", .{e});
            return e;
        };

        self.cursorSendThread = std.Thread.spawn(.{ .allocator = self.app.allocator }, Handler.repeatSendCursorData, .{self}) catch |e| {
            std.log.err("Error spawning thread: {?}", .{e});
            return e;
        };

        try self.broadcastJoin();
    }
};

// This is application-specific you want passed into your Handler's
// init function.
const App = struct {
    allocator: std.mem.Allocator,
};
