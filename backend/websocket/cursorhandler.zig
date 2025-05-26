const std = @import("std");

pub const CursorHandler = struct {
    allocator: std.mem.Allocator,
    cursors: std.AutoHashMap(u64, Cursor),

    pub const Cursor = struct { x: f64, y: f64, id: u64 = undefined };

    pub fn init(allocator: std.mem.Allocator) CursorHandler {
        return CursorHandler{
            .allocator = allocator,
            .cursors = std.AutoHashMap(u64, Cursor).init(allocator),
        };
    }

    pub fn addCursor(self: *CursorHandler, x: f64, y: f64, id: u64) !void {
        const cursor = Cursor{ .x = x, .y = y, .id = id };
        try self.cursors.put(id, cursor);
    }

    pub fn removeCursor(self: *CursorHandler, id: u64) !void {
        _ = self.cursors.remove(id);
    }

    pub fn getCursors(self: *CursorHandler) ![]Cursor {
        var cursorList = std.ArrayList(Cursor).init(self.allocator);
        defer cursorList.deinit();

        var it = self.cursors.valueIterator();

        while (it.next()) |entry| {
            try cursorList.append(entry.*);
        }

        return cursorList.toOwnedSlice();
    }
};
