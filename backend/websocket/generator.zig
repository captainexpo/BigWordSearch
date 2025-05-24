const std = @import("std");
const utils = @import("utils.zig");

pub const Word = struct {
    x: u64,
    y: u64,
    dx: i64,
    dy: i64,
    word: []const u8,

    pub fn print(self: *Word) void {
        return std.debug.print("{d}, {d}, {d}, {d}, {s}\n", .{
            self.x,
            self.y,
            self.dx,
            self.dy,
            self.word,
        });
    }
};

pub const CharMap = std.AutoHashMap(struct { x: u64, y: u64 }, u8);

pub const Generator = struct {
    SEED: u64 = @as(u64, std.math.pow(u64, 2, 25) - 912),
    grid_width: u64,
    prng: std.Random.Xoshiro256,
    words: std.ArrayList(Word),
    charMap: CharMap,

    pub fn combine(self: *Generator, x: u64, y: u64, seed: u64) u64 {
        return (x * self.grid_width) + y + seed;
    }

    pub fn getChar(self: *Generator, x: u64, y: u64) u8 {
        if (self.charMap.get(.{ .x = x, .y = y })) |char| {
            //std.log.debug("Found char: {c} at {d} {d}", .{ char, x, y });
            return char;
        }
        const seed = self.combine(x, y, self.SEED);
        self.prng.seed(seed);
        return @as(u8, @intCast(self.prng.next() % (90 - 65) + 65));
    }

    pub fn init(allocator: std.mem.Allocator, grid_width: u64) !Generator {
        const prng = std.Random.DefaultPrng.init(blk: {
            var seed: u64 = undefined;
            try std.posix.getrandom(std.mem.asBytes(&seed));
            break :blk seed;
        });
        return Generator{
            .grid_width = grid_width,
            .prng = prng,
            .words = std.ArrayList(Word).init(allocator),
            .charMap = CharMap.init(allocator),
        };
    }

    pub fn readWordsFromFile(self: *Generator, path: []const u8, allocator: std.mem.Allocator) !void {
        const file = try std.fs.cwd().openFile(path, .{});
        defer file.close();
        const file_size = try file.getEndPos();
        var buffer = try allocator.alloc(u8, file_size);
        const bytes_read = try file.readAll(buffer);
        if (bytes_read != file_size) {
            return error.FileReadError;
        }
        // Remove the last byte if it's a newline
        if (buffer[file_size - 1] == '\n') {
            buffer = buffer[0 .. file_size - 1];
        }

        var s = std.mem.tokenizeAny(u8, buffer, "\n");
        while (s.next()) |line| {
            std.log.debug("Line: {s}", .{line});
            var split = std.mem.tokenizeAny(u8, line, ",");
            const word = Word{
                .x = try std.fmt.parseUnsigned(u64, split.next() orelse "0", 10),
                .y = try std.fmt.parseUnsigned(u64, split.next() orelse "0", 10),
                .dx = try std.fmt.parseInt(i64, split.next() orelse "0", 10),
                .dy = try std.fmt.parseInt(i64, split.next() orelse "0", 10),
                .word = split.next() orelse "UNKNOWN",
            };
            try self.words.append(word);

            // Build charmap
            var x = word.x;
            var y = word.y;
            const dx = word.dx;
            const dy = word.dy;
            const word_len = word.word.len;
            for (0..word_len) |i| {
                if (x >= self.grid_width or y >= self.grid_width) {
                    break;
                }
                if (x < 0 or y < 0) {
                    break;
                }
                const char = word.word[i];
                try self.charMap.put(
                    .{ .x = x, .y = y },
                    char,
                );
                x = utils.toU64(@as(i64, @intCast(x)) + dx) catch |err| switch (err) {
                    utils.ConvertError.Negative => {
                        break;
                    },
                    else => {
                        std.log.err("Error: {?}", .{err});
                        return err;
                    },
                };
                y = utils.toU64(@as(i64, @intCast(y)) + dy) catch |err| switch (err) {
                    utils.ConvertError.Negative => {
                        break;
                    },
                    else => {
                        std.log.err("Error: {?}", .{err});
                        return err;
                    },
                };
            }
        }
    }

    pub fn getBlock(self: *Generator, allocator: std.mem.Allocator, x1: usize, y1: usize, x2: usize, y2: usize) ![]u8 {
        if (x1 >= x2 or y1 >= y2) {
            std.log.err("Invalid input: {d} {d} {d} {d}", .{ x1, y1, x2, y2 });
            return error.InvalidGridCoordinates;
        }
        if (x1 > self.grid_width or y1 > self.grid_width or x2 > self.grid_width or y2 > self.grid_width) {
            std.log.err("Invalid input: {d} {d} {d} {d}", .{ x1, y1, x2, y2 });
            return error.InvalidGridCoordinates;
        }
        if (x1 < 0 or y1 < 0 or x2 < 0 or y2 < 0) {
            std.log.err("Invalid input: {d} {d} {d} {d}", .{ x1, y1, x2, y2 });
            return error.InvalidGridCoordinates;
        }
        // Returns a string of chars, lines separated by NULL
        const w = x2 - x1;
        const h = y2 - y1;

        var buff: []u8 = try allocator.alloc(u8, h * w + (h - 1));
        var idx: usize = 0;

        for (0..h) |y| {
            for (0..w) |x| {
                buff[idx] = self.getChar(x + x1, y + y1);
                idx += 1;
            }
            if (y != h - 1) {
                buff[idx] = '\n';
                idx += 1;
            }
        }
        return buff;
    }

    pub fn getLine(self: *Generator, allocator: std.mem.Allocator, x1: u64, y1: u64, x2: u64, y2: u64) ![]u8 {
        // Calculate deltas
        const dx: i64 = @as(i64, @intCast(x2)) - @as(i64, @intCast(x1));
        const dy: i64 = @as(i64, @intCast(y2)) - @as(i64, @intCast(y1));

        // Determine the number of steps (max of abs(dx), abs(dy)) + 1
        const steps: usize = @intCast(@max(@abs(dx), @abs(dy)) + 1);

        // Calculate step direction
        const step_x: i64 = if (dx == 0) 0 else if (dx > 0) 1 else -1;
        const step_y: i64 = if (dy == 0) 0 else if (dy > 0) 1 else -1;

        var buff = try allocator.alloc(u8, steps);

        var x: i64 = @as(i64, @intCast(x1));
        var y: i64 = @as(i64, @intCast(y1));

        for (0..steps) |i| {
            if (x < 0 or y < 0 or x >= @as(i64, @intCast(self.grid_width)) or y >= @as(i64, @intCast(self.grid_width))) {
                return error.InvalidGridCoordinates;
            }
            buff[i] = self.getChar(@as(u64, @intCast(x)), @as(u64, @intCast(y)));
            x += step_x;
            y += step_y;
        }
        std.log.debug("Line: {s}", .{buff});
        return buff;
    }

    pub fn wordFound(self: *Generator, x1: u64, y1: u64, x2: u64, y2: u64) !void {
        // Update the positions in the charMap
        const dx: i64 = @as(i64, @intCast(x2)) - @as(i64, @intCast(x1));
        const dy: i64 = @as(i64, @intCast(y2)) - @as(i64, @intCast(y1));
        const steps: usize = @intCast(@max(@abs(dx), @abs(dy)) + 1);
        const step_x: i64 = if (dx == 0) 0 else if (dx > 0) 1 else -1;
        const step_y: i64 = if (dy == 0) 0 else if (dy > 0) 1 else -1;
        var x: i64 = @as(i64, @intCast(x1));
        var y: i64 = @as(i64, @intCast(y1));
        for (0..steps) |_| {
            if (x < 0 or y < 0 or x >= @as(i64, @intCast(self.grid_width)) or y >= @as(i64, @intCast(self.grid_width))) {
                return error.InvalidGridCoordinates;
            }
            try self.charMap.put(
                .{ .x = try utils.toU64(x), .y = try utils.toU64(y) },
                0,
            );
            x += step_x;
            y += step_y;
        }
    }
};
