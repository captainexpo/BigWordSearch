import random
import sys 

INPUT_FILE = sys.argv[1] if len(sys.argv) > 1 else "words.txt"
OUTPUT_FILE = sys.argv[2] if len(sys.argv) > 2 else "word_positions.txt"
WIDTH = int(sys.argv[3]) if len(sys.argv) > 3 else 100
HEIGHT = int(sys.argv[4]) if len(sys.argv) > 4 else 100
NUM_WORDS = int(sys.argv[5]) if len(sys.argv) > 5 else 1000

DIRECTIONS = [
    (0, 1),   # down
    (1, 0),   # right
    (1, 1),   # down-right
    #(-1, 0),  # left
    #(0, -1),  # up
    #(-1, -1), # up-left
    #(-1, 1),  # down-left
    #(1, -1),  # up-right
]

def load_words(filename):
    words = []
    with open(filename, "r") as f:
        words = [line.strip().upper() for line in f if line.strip().isalpha()]
    return [i for i in words if len(i) >= 4]
def get_valid_start(word, dx, dy):
    word_len = len(word)
    # Calculate valid range for x
    if dx == 0:
        min_x = 0
        max_x = WIDTH - 1
    elif dx > 0:
        min_x = 0
        max_x = WIDTH - word_len
    else:  # dx < 0
        min_x = word_len - 1
        max_x = WIDTH - 1

    # Calculate valid range for y
    if dy == 0:
        min_y = 0
        max_y = HEIGHT - 1
    elif dy > 0:
        min_y = 0
        max_y = HEIGHT - word_len
    else:  # dy < 0
        min_y = word_len - 1
        max_y = HEIGHT - 1

    if min_x > max_x or min_y > max_y:
        return None

    x = random.randint(min_x, max_x)
    y = random.randint(min_y, max_y)
    return x, y

def generate_word_positions(words, count):
    output = []
    used = set()
    while len(output) < count and words:
        wordidx = int(random.random()**2.5 * len(words))
        print(f"wordidx: {wordidx}")
        word = words[wordidx]
        dx, dy = random.choice(DIRECTIONS)
        pos = get_valid_start(word, dx, dy)
        if pos is None:
            continue
        x, y = pos
        key = (x, y, dx, dy, word)
        if key in used:
            continue
        output.append(f"{x},{y},{dx},{dy},{word}")
        used.add(key)
    return output

def main():
    words = load_words(INPUT_FILE)
    positions = generate_word_positions(words, NUM_WORDS)
    with open(OUTPUT_FILE, "w") as f:
        for line in positions:
            f.write(line + "\n")
    print(f"Wrote {len(positions)} words to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
