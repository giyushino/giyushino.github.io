#!/usr/bin/env python3
"""
Markdown to HTML blog post converter.

Usage:
    python translate.py                    # Convert all .md files in posts/md/
    python translate.py my-post.md         # Convert a specific file

No external dependencies required.
"""

import re
import sys
from pathlib import Path

from template import TEMPLATE


def parse_frontmatter(content: str) -> tuple[dict, str]:
    """Extract YAML frontmatter from markdown content."""
    if not content.startswith('---'):
        return {}, content

    parts = content.split('---', 2)
    if len(parts) < 3:
        return {}, content

    frontmatter = {}
    for line in parts[1].strip().split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            frontmatter[key.strip()] = value.strip()

    return frontmatter, parts[2].strip()


def process_sidenotes(content: str) -> str:
    """Convert {{sidenote: text}} syntax to HTML sidenotes."""
    pattern = r'\{\{sidenote:\s*(.*?)\}\}'
    counter = [0]

    def replace_sidenote(match):
        counter[0] += 1
        note_text = match.group(1)
        return (
            f'<sup class="sidenote-ref">{counter[0]}</sup>'
            f'<span class="sidenote" data-note-number="{counter[0]}">{note_text}</span>'
        )

    return re.sub(pattern, replace_sidenote, content)


def markdown_to_html(text: str) -> str:
    """Simple markdown to HTML converter."""
    lines = text.split('\n')
    html_lines = []
    in_code_block = False
    code_lang = ''
    code_lines = []
    in_list = False

    i = 0
    while i < len(lines):
        line = lines[i]

        # Code blocks
        if line.startswith('```'):
            if not in_code_block:
                in_code_block = True
                code_lang = line[3:].strip()
                code_lines = []
            else:
                in_code_block = False
                code_content = '\n'.join(code_lines)
                # Escape HTML in code
                code_content = code_content.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                html_lines.append(f'<pre><code>{code_content}</code></pre>')
            i += 1
            continue

        if in_code_block:
            code_lines.append(line)
            i += 1
            continue

        # Empty lines
        if not line.strip():
            if in_list:
                html_lines.append('</ul>')
                in_list = False
            html_lines.append('')
            i += 1
            continue

        # Headers
        if line.startswith('######'):
            html_lines.append(f'<h6>{process_inline(line[6:].strip())}</h6>')
        elif line.startswith('#####'):
            html_lines.append(f'<h5>{process_inline(line[5:].strip())}</h5>')
        elif line.startswith('####'):
            html_lines.append(f'<h4>{process_inline(line[4:].strip())}</h4>')
        elif line.startswith('###'):
            html_lines.append(f'<h3>{process_inline(line[3:].strip())}</h3>')
        elif line.startswith('##'):
            html_lines.append(f'<h2>{process_inline(line[2:].strip())}</h2>')
        elif line.startswith('#'):
            # Skip h1 since title is already in template
            pass

        # Unordered lists
        elif line.strip().startswith('- ') or line.strip().startswith('* '):
            if not in_list:
                html_lines.append('<ul>')
                in_list = True
            content = line.strip()[2:]
            html_lines.append(f'<li>{process_inline(content)}</li>')

        # Regular paragraphs
        else:
            html_lines.append(f'<p>{process_inline(line)}</p>')

        i += 1

    if in_list:
        html_lines.append('</ul>')

    return '\n'.join(html_lines)


def process_inline(text: str) -> str:
    """Process inline markdown: bold, italic, code, links."""
    # Inline code (must come before bold/italic to avoid conflicts)
    text = re.sub(r'`([^`]+)`', r'<code>\1</code>', text)

    # Bold
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__([^_]+)__', r'<strong>\1</strong>', text)

    # Italic
    text = re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)
    text = re.sub(r'_([^_]+)_', r'<em>\1</em>', text)

    # Links
    text = re.sub(r'\[([^\]]+)\]\(([^)]+)\)', r'<a href="\2" class="link-underline">\1</a>', text)

    return text


def process_file(md_path: Path, output_dir: Path) -> None:
    """Convert a single markdown file to HTML."""
    content = md_path.read_text(encoding='utf-8')

    # Parse frontmatter
    frontmatter, body = parse_frontmatter(content)
    title = frontmatter.get('title', 'Untitled')
    date = frontmatter.get('date', '')

    # Process sidenotes before markdown conversion
    body = process_sidenotes(body)

    # Convert markdown to HTML
    html_body = markdown_to_html(body)

    # Fill template
    html = TEMPLATE.format(
        blog_title=title,
        date=date,
        body=html_body
    )

    # Write output
    output_path = output_dir / f"{md_path.stem}.html"
    output_path.write_text(html, encoding='utf-8')
    print(f"Created: {output_path}")


def main():
    # Determine paths
    script_dir = Path(__file__).parent
    md_dir = script_dir.parent / 'md'
    output_dir = script_dir.parent  # posts/ directory

    # Ensure md directory exists
    if not md_dir.exists():
        print(f"Error: {md_dir} does not exist.")
        print(f"Create it with: mkdir {md_dir}")
        sys.exit(1)

    # Get files to process
    if len(sys.argv) > 1:
        # Process specific file(s)
        files = [md_dir / arg for arg in sys.argv[1:]]
    else:
        # Process all .md files
        files = list(md_dir.glob('*.md'))

    if not files:
        print(f"No .md files found in {md_dir}")
        sys.exit(0)

    for md_file in files:
        if not md_file.exists():
            print(f"Warning: {md_file} not found, skipping")
            continue
        process_file(md_file, output_dir)

    print(f"\nDone! Converted {len(files)} file(s).")


if __name__ == '__main__':
    main()
