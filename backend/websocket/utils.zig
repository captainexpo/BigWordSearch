const std = @import("std"); //import the standard library
pub const ConvertError = error //we create an error that means we will return if the value was too high or too low
    {
        TooBig,
        TooSmall,
        Negative,
    };

pub fn toI64(input: u64) !i64 {
    const MAX_I64: i64 = std.math.maxInt(i64); //get the maximum possible value for an i64 from the standard library

    const MIN_I64: i64 = std.math.minInt(i64); //get the minimum possible value for an i64 from the standard library

    if (input > MAX_I64) { //if it's higher than the max value
        return ConvertError.TooBig; //return an error
    }
    if (input < MIN_I64) { //if it's lower than the min value
        return ConvertError.TooSmall; //return an error
    }
    return @intCast(input); //otherwise return the input casted to an i64
}

pub fn toU64(input: i64) !u64 {
    if (input < 0) { //if the input is negative
        return ConvertError.Negative; //return an error
    }

    const MAX_U64: u64 = std.math.maxInt(u64); //get the maximum possible value for an u64 from the standard library

    const MIN_U64: u64 = std.math.minInt(u64); //get the minimum possible value for an u64 from the standard library

    if (input > MAX_U64) { //if it's higher than the max value
        return ConvertError.TooBig; //return an error
    }
    if (input < MIN_U64) { //if it's lower than the min value
        return ConvertError.TooSmall; //return an error
    }
    return @intCast(input); //otherwise return the input casted to an u64
}
