const std = @import("std");

pub const Generator = struct {
    SEED: u64 = 1337,
    grid_width: u64,
    prng: std.Random.Xoshiro256,

    pub fn combine(self: *Generator, x: u64, y: u64, seed: u64) u64 {
        return (x * self.grid_width) + y + seed;
    }

    pub fn getChar(self: *Generator, x: u64, y: u64) u8 {
        const seed = self.combine(x, y, self.SEED);
        self.prng.seed(seed);
        return @as(u8, @intCast(self.prng.next() % (90 - 65) + 65));
    }

    pub fn init(allocator: std.mem.Allocator, grid_width: u64) !Generator {
        _ = allocator;
        const prng = std.Random.DefaultPrng.init(blk: {
            var seed: u64 = undefined;
            try std.posix.getrandom(std.mem.asBytes(&seed));
            break :blk seed;
        });
        return Generator{
            .grid_width = grid_width,
            .prng = prng,
        };
    }

    pub fn getBlock(self: *Generator, allocator: std.mem.Allocator, x1: usize, y1: usize, x2: usize, y2: usize) ![]u8 {
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
};
