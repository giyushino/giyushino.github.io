---
title: To Obtain a Token
date: 2026-05-12
tag: technical
readingTime: ?? min
blurb: temp for a technical blog
---

If you give an LLM a few words, a GPU, and a few watts, it'll spit out a token. But how exactly does this all work under the hood? To uncover the magic of LLMs, we'll be implementing Qwen3 from scratch to see what's really going on.

test

```python
from transformers import AutoTokenizer, AutoModelForCausalLM

MODEL_NAME = "Qwen/Qwen3-4B-Instruct-2507"
model = AutoModelForCausalLM.from_pretrained(MODEL_NAME)
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
```
