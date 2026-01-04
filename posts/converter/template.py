TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{blog_title}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="../styles.css">
    <link id="hljs-theme" rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
    <script>
        MathJax = {{
            tex: {{
                inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
                displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']]
            }}
        }};
    </script>
    <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js" async></script>
</head>
<body>
    <header>
        <nav>
            <div class="logo"><a href="post.html" style="text-decoration: none; color: inherit;">BLOG</a></div>
            <ul class="nav-links">
                <li><a href="../index.html">ABOUT</a></li>
            </ul>
            <button class="theme-toggle" aria-label="Toggle dark mode">
                <span class="theme-icon"></span>
            </button>
        </nav>
    </header>

    <main>
        <div class="container blog-post">
            <article class="about-content">
                <h1>{blog_title}</h1>
                <p>{date}</p>
                {body}
            </article>
        </div>
    </main>
    <script>
        const toggle = document.querySelector('.theme-toggle');
        const icon = toggle.querySelector('.theme-icon');
        const hljsTheme = document.getElementById('hljs-theme');

        function setTheme(dark) {{
            document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
            icon.textContent = dark ? 'light' : 'dark';
            hljsTheme.href = dark
                ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css'
                : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css';
            localStorage.setItem('theme', dark ? 'dark' : 'light');
        }}

        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(saved ? saved === 'dark' : prefersDark);
        hljs.highlightAll();

        toggle.addEventListener('click', () => {{
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            setTheme(!isDark);
        }});
    </script>
</body>
</html>
'''
