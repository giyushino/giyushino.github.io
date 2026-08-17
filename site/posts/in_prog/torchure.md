---
title: Torchure, My Very Own Training Stack!
date: 2026-08-16
tag: technical
readingTime: ?? min
blurb: An in depth look into distributed LLM training
---
Given that I was j*bless this summer, I decided it was the perfect
time to finally work on a project I've been thinking about for a long
time, which is to write my own distributed training stack. I flirted
with this idea for a while, but it always seemed so daunting and complex, 
so I always put it off to the side.


## DDP
data parallel training

## FSDP
fully sharded data parallel

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim

model = myModel(**model_cfg)
dataloader = myDataloader(**dataloader_cfg)
optimizer = torch.optim.AdamW(model.parameters(), lr=3e-4)

for epoch in range(epochs):
    for batch in dataloader:
        batch = batch.to(device)
        logits = model(batch)
        B, S, V = logits.shape

        labels = torch.full_like(batch, IGNORE_INDEX)
        labels[:, :-1] = batch[:, 1:]

        loss = F.cross_entropy(
            logits.reshape(-1, V),
            labels.reshape(-1),
            ignore_index=IGNORE_INDEX,
        )

        optimizer.zero_grad(set_to_none=True)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step()`

