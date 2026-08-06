#!/usr/bin/env python3
"""Strip invisible glyphs from an ASCIInator SVG export into site/img/.

The export draws every cell of the grid, including the ones that came out pure
black. Against a dark page those are invisible, but the browser still parses
and rasterises each one — on a full-viewport background that's the difference
between a scene that appears with the page and one that arrives a beat late.

Dropping them is usually more than half the file. Nothing visible changes *so
long as the page behind it stays dark* — on a light background these glyphs
would be legitimate marks, so keep the original export around.

    python3 tools/optimize-ascii-svg.py asciinator_6Aug_003_02.svg site/img/bg-003.svg
"""
import gzip
import re
import sys
from pathlib import Path

# A <use> painted pure black. ASCIInator writes fill and stroke as a pair, so
# matching the fill is enough to identify the cell.
BLACK_USE = re.compile(r'<use [^>]*fill="#000000"[^>]*/>')

def main(src, dest):
    svg = Path(src).read_text(encoding='utf-8')
    before = svg.count('<use')

    out = BLACK_USE.sub('', svg)
    after = out.count('<use')

    # The glyph <defs> are shared, so some may now be referenced by nothing.
    # They're a rounding error next to the <use> list, and dropping a def that
    # is still live would silently blank characters, so they stay.
    Path(dest).write_text(out, encoding='utf-8')

    raw = len(out.encode())
    gz = len(gzip.compress(out.encode(), 6))
    print(f'{before} -> {after} glyphs ({100 * (before - after) // before}% removed)')
    print(f'{dest}: {raw / 1024:.0f} KB raw, {gz / 1024:.0f} KB gzipped')

if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__.strip().splitlines()[-1].strip())
    main(sys.argv[1], sys.argv[2])
