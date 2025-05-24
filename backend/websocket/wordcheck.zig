const std = @import("std");
const Generator = @import("generator.zig").Generator;

pub const WordChecker = struct {
    allocator: std.mem.Allocator,
    generator: *Generator,

    wordList: std.StringHashMap(u1),

    pub fn init(allocator: std.mem.Allocator, generator: *Generator) WordChecker {
        return WordChecker{
            .allocator = allocator,
            .generator = generator,
            .wordList = std.StringHashMap(u1).init(allocator),
        };
    }

    pub fn readFromDictionary(self: *WordChecker, path: []const u8) !void {
        const file = try std.fs.cwd().openFile(path, .{});
        defer file.close();

        const reader = file.reader();

        // Read each line from the file and add it to the word list
        const all = try reader.readAllAlloc(self.allocator, std.math.maxInt(u64));
        var lines = std.mem.tokenizeAny(u8, all, "\n");
        while (lines.next()) |line| {
            try self.wordList.put(line, 1);
        }

        std.debug.print("Word list size: {}\n", .{self.wordList.count()});
    }

    pub fn checkWord(self: *WordChecker, x1: u64, y1: u64, x2: u64, y2: u64, notifyGenerator: bool) !bool {
        // Make sure length of word is >= 4
        const dx = @as(i64, @intCast(x2)) - @as(i64, @intCast(x1));
        const dy = @as(i64, @intCast(y2)) - @as(i64, @intCast(y1));
        const length = @sqrt(@as(f64, @floatFromInt(dx * dx + dy * dy)));
        std.debug.print("Length: {}\n", .{length});
        if (length < 3) {
            return false;
        }

        const word = try self.generator.getLine(self.allocator, x1, y1, x2, y2);
        const isin = self.wordList.get(word) orelse 0;
        std.debug.print("Word: {s}, isin: {}\n", .{ word, isin });
        if (isin == 0) {
            return false;
        }
        if (notifyGenerator) {
            try self.generator.wordFound(x1, y1, x2, y2);
        }
        return true;
    }
};
